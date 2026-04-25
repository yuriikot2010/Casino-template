const { fork } = require('child_process');

// Adjust the paths if your files are in subfolders
const webProcess = fork('./web.js');
const botProcess = fork('./bot.js');

webProcess.on('message', (msg) => {
  console.log('Message from web:', msg);
});

botProcess.on('message', (msg) => {
  console.log('Message from bot:', msg);
});

webProcess.on('exit', (code) => {
  console.log(`Web process exited with code ${code}`);
});

botProcess.on('exit', (code) => {
  console.log(`Bot process exited with code ${code}`);
});