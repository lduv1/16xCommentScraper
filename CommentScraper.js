var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var fs = require('fs');
var $ = jQuery = require('jquery');
require('jquery-csv');

//put your access token in to a file called token.txt and put it in the same directory
var token = fs.readFileSync("token.txt");
var xhttp = new XMLHttpRequest();

//specific to how our courses are named, used to filter courses to reduce runtime
var term = "F2016"
var classNum = "161"

var consentListPath = "consent.csv"

//TO ADD: commenter's critique grade

//
//
//
//
//          Consenting student list input and checking
//
//
//
//

//array of consenting students
var consentList = [];

//read file
var consentRaw = fs.readFileSync(consentListPath).toString();

//parse string to array with only the first column (Name must match Canvas)
$.csv.toArrays(consentRaw, {}, function(err, data) {
    for(var i=0, len=data.length; i<len; i++) {
        consentList.push(data[i][0])
    }
});

//console.log(consentList);



//
//
//
//
//          API calls and file output
//
//
//
//



//make a file CLASSNUM-TERM.txt
var stream = fs.createWriteStream(classNum +"-"+ term+".txt");

stream.once('open', function(fd){

    //deliminating with ` because nobody uses it
    stream.write("Commenter Name`Comment`Submission Grade`Comment Word Length`Submission Author ID`nth Comment\n")

    var url = "https://oregonstate.instructure.com/api/v1/";
    //limited to 100 courses per request, only 10 by default,
    for(var i = 1; i <= 2; i++){

        //get the data
        xhttp.open("GET", url + "courses?enrollment_type=ta&include=total_students&per_page=100&page=" + i + "&access_token=" + token, false);
        xhttp.send(null);
        var courseResponse = JSON.parse(xhttp.responseText);
        //console.log(courseResponse);

        //for each course returned
        courseResponse.forEach(function(course){
            //console.log(course);

            //filtering out courses to speed up runtime,
            if(course.total_students <= 15 && course.course_code.includes(term) && course.course_code.includes(classNum)){
                var coursesStr = "courses/" + course.id;

                //get the assignments
                xhttp.open("GET", url + coursesStr + "/assignments?access_token=" + token, false);
                xhttp.send(null);
                var assignmentResponse = JSON.parse(xhttp.responseText);

                //for each assignment
                assignmentResponse.forEach(function(assignment){

                    //specifying that the assignment is a design assignment
                    if(assignment.name.includes("Design")){

                        //write out the assignment name
                        console.log(assignment.name);
                        stream.write(assignment.name + "\n");

                        var assignmentStr = "/assignments/" + assignment.id;

                        //get the submissions, including comments
                        xhttp.open("GET", url + coursesStr + assignmentStr +"/submissions?include=submission_comments&access_token=" + token, false);
                        xhttp.send(null);
                        var submissionResponse = JSON.parse(xhttp.responseText);

                        //for each submission
                        submissionResponse.forEach(function(submission){

                            //for counting how many times each person has commented on a post
                            var commenterIDs = [];

                            //for each comment
                            submission.submission_comments.forEach(function(comment){

                                //filter out TA and submitter comments, also check if the author's name is in the consent list
                                if(comment.author_id != submission.grader_id && comment.author_id != submission.user_id){
                                    if(consentList.includes(comment.author_name)){

                                        //regular expression to replace all new lines and carriage returns
                                        var contents = comment.comment.replace(/(\r\n|\n|\r)/gm,"");

                                        //add comment author id to array, used to calculate previous comments
                                        commenterIDs.push(comment.author_id);

                                        //the number of previous comments this commenter submitted
                                        var numPrevComments = 0;
                                        for(var i = 0; i < commenterIDs.length; i++){
                                            if(commenterIDs[i] == comment.author_id) numPrevComments++;
                                        }

                                        //basic wordcount
                                        var wordCount = 0;
                                        for (var i = 1; i < comment.comment.length; i++){
                                            if (comment.comment[i] == " " && comment.comment[i-1] != " ") {
                                                wordCount++;
                                            }
                                        }
                                        wordCount++;

                                        //write to the file
                                        stream.write(comment.author_name + "`\"" + contents + "\"`" +submission.score + "`" + wordCount + "`" + submission.user_id + "`" + numPrevComments +"\n" );
                                    }
                                }

                            });
                        });
                    }
                });
            }
        });
    }
    //close file
    stream.end();
});
