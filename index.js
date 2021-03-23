process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0; //dirty hack, but its a cheap script, so who cares

const fs = require("fs");
const path = require("path");
const rateLimit = require("rate-limit");
const needle = require("needle");
const {JSDOM} = require("jsdom");
const gis = require("g-i-s");
const mime = require("mime-types");

let queue = rateLimit.createQueue({interval: 250});

function downloadGroup(additionalPath) {

    let folderName = String(path.join(__dirname, "/mod", additionalPath));
    if(path != "" && !fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
        getIndex();
    } else {
        getIndex();
    }
    function getIndex() {
        queue.add(() => {
            let url = "https://drednot.io/img/" + additionalPath;
            needle.get(url, (err, response) => {
                if(err) throw err;
                console.log("GOT " + url);

                const {document} = (new JSDOM(response.body)).window;

                let aElements = document.getElementsByTagName("a");
                let filenames = [];

                for(let i in aElements) {
                    filenames.push(String(aElements[i].href));
                }
                filenames.shift(); // remove nginx's "../" element, which could screw up our indexing
                while(true) {
                    if(filenames[0].endsWith("/")) { // link is folder
                        filenames.shift(); // folders are displayed at top
                    } else break; // once folders end, we can break from loop
                }

                function downloadAsset(uri) {
                    let imagename = uri.split(".")[0].replace("_", " "); // exclude file extension, replace underscores with spaces
                    queue.add(() => {
                        gis(imagename, (err, results) => {
                            if(err) throw err;
                            
                            let link = "";
                            if(!results[0]) link = "http://placekitten.com/300/300"; // failsafe
                            else link = results[0].url;
                            console.log(`${imagename}: ${link}`);

                            queue.add(() => {
                                console.log(link);
                                needle.get(link, (err, response) => {
                                    if(err) throw err;
                                    
                                    let extension = mime.extension(response.headers["content-type"]) || link.split(".")[1];
                                    
                                    fs.writeFile(path.join(folderName, `${uri}.${extension}`), response.body, (err) => {
                                        console.log(`${uri}.${extension}`);
                                        if(err) throw err;
                                    });
                                });
                            });
                        });
                    });
                }

                for(let i in filenames) {
                    downloadAsset(filenames[i]);
                }
            });
        });
    }
}

downloadGroup("");
downloadGroup("item/")
downloadGroup("cosmetic/");