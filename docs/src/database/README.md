# Local  Database 

SQLDelight generates typesafe Kotlin APIs from your SQL statements. It verifies your schema, statements, and migrations at compile-time and provides IDE features like autocomplete and refactoring which make writing and maintaining SQL simple.

SQLDelight understands your existing SQL schema.

```sql
CREATE TABLE hockey_player (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  number INTEGER NOT NULL
);
```

It generates typesafe code for any labeled SQL statements.

::: warning 

Be carefull with SQL Delight , the project and his dependancies just move from `com.squareup.sqldelight.*`
to `app.cash.sqldelight.*`

Pay attention also with beta, alpha version of Android studio that could produce bugs on gradle task management for code generation of SQL Delight databases.
:::


## 🧪 Add sqldelight db to your quizz 

> Refer to the multiplatform implementation of SQLDelight in official Github pages
> 👉 [https://cashapp.github.io/sqldelight/2.0.0/android_sqlite/](https://cashapp.github.io/sqldelight/2.0.0/android_sqlite/)


#### Add the correct dependancies to the project
*libs.versions.toml*
``` kotlin
...
sqldelight = "2.0.1"

[libraries]
...
sqldelight = { group = "app.cash.sqldelight", name = "runtime", version.ref = "sqldelight"}
sqldelight-android-driver = { group = "app.cash.sqldelight", name = "android-driver", version.ref = "sqldelight"}

[plugins]
...
sqldelight = { id = "app.cash.sqldelight", version.ref = "sqldelight" }
...
```

*build.gradle.kts (App)*
```kotlin
dependencies {
    ...
    implementation(libs.sqldelight)
    implementation(libs.sqldelight.android.driver)
    ...
```

#### Read carefully the modelisation UML below 

![diagram SQL ](../assets/images/diagramme_sql.png)

#### Create you SQLDelight model 'QuizDatabase.sq'

#### Create your Database datasource by generating insert and update suspending functions

#### Update your repository by instanciating your database

Your repository handle the following cases :
* If there is no network and it's the first time launch of the app : handle and error 
* if there is no network and you have db datas : return on the flow the db data
* if there is network and db data are younger than 5 min : return on the flow the db data
* if there is network and db data are older than 5 min : retourn on the flow the network data and reset db data


## 🎯 Solutions

::: details QuizDatabase.sq *

```sql
CREATE TABLE update_time (
     timestamprequest INTEGER
);

INSERT INTO update_time(timestamprequest) VALUES (0);

CREATE TABLE questions (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    correctAnswerId INTEGER  NOT NULL
 );


 CREATE TABLE answers (
    id INTEGER NOT NULL,
    label TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    PRIMARY KEY (id, question_id),
    FOREIGN KEY (question_id)
      REFERENCES questions (id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
 );



 selectUpdateTimestamp:
 SELECT *
 FROM update_time;

 insertTimeStamp:
 INSERT INTO update_time(timestamprequest)
 VALUES (:timestamp);

 deleteTimeStamp:
 DELETE FROM update_time;

 deleteQuestions:
 DELETE FROM questions;

 deleteAnswers:
 DELETE FROM answers;


 selectAllQuestionsWithAnswers:
 SELECT *
 FROM questions
 INNER JOIN answers ON questions.id = answers.question_id;

 insertQuestion:
 INSERT INTO questions(id, label,correctAnswerId)
 VALUES (?, ?, ?);

 insertAnswer:
 INSERT INTO answers(id, label,question_id)
 VALUES (?, ?, ?);

```
:::

::: details network/QuizDbDataSource.kt
``` kotlin
package com.example.quizappandroid.network

import android.content.Context
import androidx.sqlite.db.SupportSQLiteDatabase
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.example.quizappandroid.network.data.Answer
import com.example.quizappandroid.network.data.Question
import com.myapplication.common.cache.Database
import kotlinx.coroutines.CoroutineScope


class QuizDbDataSource(context:Context) {
    private  var sqlDriver = AndroidSqliteDriver(
        schema = Database.Schema,
        context = context,
        name = "quiz.db",
        callback = object : AndroidSqliteDriver.Callback(Database.Schema) {
            override fun onOpen(db: SupportSQLiteDatabase) {
                db.setForeignKeyConstraintsEnabled(true)
            }
        }
    )
    private  var database= Database(sqlDriver)
    private  var quizQueries=database.quizDatabaseQueries


    suspend fun getUpdateTimeStamp():Long = quizQueries.selectUpdateTimestamp().executeAsOneOrNull()?.timestamprequest ?: 0L


    suspend fun setUpdateTimeStamp(timeStamp:Long)  {
        quizQueries.deleteTimeStamp()
        quizQueries.insertTimeStamp(timeStamp)
    }

    suspend fun getAllQuestions(): List<Question> {
        return quizQueries.selectAllQuestionsWithAnswers().executeAsList()
            .groupBy {it.question_id }
            .map { (questionId, rowList) ->

                Question(
                    id = questionId,
                    label = rowList.first().label,
                    correctAnswerId = rowList.first().correctAnswerId,
                    answers = rowList.map { answer ->
                        Answer(
                            id = answer.id_,
                            label = answer.label_
                        )
                    }
                )
            }
    }



    suspend fun insertQuestions(questions:List<Question>) {
        quizQueries.deleteQuestions();
        quizQueries.deleteAnswers()
        questions.forEach {question ->
            quizQueries.insertQuestion(question.id, question.label, question.correctAnswerId)
            question.answers.forEach {answer ->
                quizQueries.insertAnswer(answer.id,answer.label,question.id)
            }
        }
    }
}

```
:::

::: details QuizRepository.kt
```kotlin
package network

import android.content.Context
import com.example.quizappandroid.network.MockDataSource
import com.example.quizappandroid.network.QuizApiDatasource
import com.example.quizappandroid.network.QuizDbDataSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.example.quizappandroid.network.data.Question


class QuizRepository(context:Context)  {

    private val mockDataSource = MockDataSource()
    private val quizAPI = QuizApiDatasource()
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    private var quizDB = QuizDbDataSource(context)

    private var _questionState=  MutableStateFlow(listOf<Question>())
    var questionState = _questionState

    init {
        updateQuiz()
    }

    private suspend fun fetchQuiz(): List<Question> = quizAPI.getAllQuestions().questions

    private suspend fun fetchAndStoreQuiz(): List<Question>{
        val questions  = fetchQuiz()
        quizDB.insertQuestions(questions)
        quizDB.setUpdateTimeStamp(System.currentTimeMillis()/1000)
        return questions
    }
    private fun updateQuiz(){


        coroutineScope.launch {
            _questionState.update {
                try {
                    val lastRequest = quizDB.getUpdateTimeStamp()
                    if(lastRequest == 0L || lastRequest - System.currentTimeMillis()/1000 > 300000){
                        fetchAndStoreQuiz()

                    }else{
                        quizDB.getAllQuestions()
                    }
                } catch (e: NullPointerException) {
                    fetchAndStoreQuiz()
                } catch (e: Exception) {
                    e.printStackTrace()
                    mockDataSource.generateDummyQuestionsList()
                }

            }
        }
    }
}
```
:::

::: tip
if you want to store  simple key-value data, you can use [`DataStore`]('https://developer.android.com/reference/kotlin/androidx/datastore/package-summary.html')

For not using SQLight ORM, you can use [`Realm kotlin`](https://github.com/realm/realm-kotlin) 
:::


**✅ If everything is fine, go to the next chapter →**


## 📖 Further reading 
- [SQL Delight lib ](https://github.com/cashapp/sqldelight)


