const { app, BrowserWindow, ipcMain } = require('electron');

let debugMode = true;
let timerInterval;
let seconds = 0;
let currCourse = null;

// students stored "name": [course, totalSeconds]
let dataMap = new Map();

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Enable context isolation for better security
        },
    });

    win.loadFile('index.html');
}

// Listen for a request from the renderer process
ipcMain.on('get-curr-course', (event) => {
    if (currCourse === null) {
        event.sender.send('curr-course-value', 'No course selected'); // Send a default value
    }
    else {
        event.sender.send('curr-course-value', currCourse); // Send the current course value
    }
});

// Update current course
ipcMain.on('update-course', (event, inputCourseNumber) => {
    currCourse = inputCourseNumber; // Update the global variable
    event.sender.send('curr-course-value', currCourse); // Send the current course value

    if (debugMode) {
        console.log('DEBUG: Current course updated to ' + currCourse); // Optional: log for debugging
    }
});

// Add new student
ipcMain.on('add-student', (event, studentName, course) => {
    dataMap.set(studentName, [course, 0]);
    event.sender.send('student-added', studentName, course, 0); // Send the student name back to the renderer process
    if (debugMode) {
        console.log('DEBUG: ' + studentName + ' in ' + currCourse + ' added'); // Optional: log for debugging
        console.log('DEBUG: new entry' + dataMap.get(studentName)); // Optional: log for debugging
    }
});

// Start the timer
ipcMain.on('start-timer', (event) => {
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            seconds++;
            event.sender.send('update-timer', seconds);
        }, 1000);
    }

    if (debugMode) {
        console.log('DEBUG: Timer started'); // Optional: log for debugging
    }
});

// Stop the timer
ipcMain.on('stop-timer', () => {
    clearInterval(timerInterval);
    timerInterval = null;
    if (debugMode) {
        console.log('DEBUG: Timer stopped'); // Optional: log for debugging
    }
});

// Create window when app is ready
app.whenReady().then(createWindow);

// Handle window close events
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
