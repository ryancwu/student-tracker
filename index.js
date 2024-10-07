const { app, BrowserWindow, ipcMain } = require("electron");

let debugMode = true;
let timerInterval;
let seconds = 0;
let currCourse = null;

// students stored "name": {course, totalSeconds, isRunning}
let dataMap = new Map();

// current student with running timer
let prevRunningTimer = "";

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Enable context isolation for better security
    },
  });

  win.loadFile("index.html");
}

// Listen for a request from the renderer process
ipcMain.on("get-curr-course", (event) => {
  if (currCourse === null) {
    event.sender.send("curr-course-value", null); // Send a default value
  } else {
    event.sender.send("curr-course-value", currCourse); // Send the current course value
  }
});

// Update current course
ipcMain.on("update-course", (event, inputCourseNumber) => {
  currCourse = inputCourseNumber; // Update the global variable
  event.sender.send("curr-course-value", currCourse); // Send the current course value

  if (debugMode) {
    console.log("DEBUG: Current course updated to " + currCourse); // Optional: log for debugging
  }
});

// Add new student
ipcMain.on("add-student", (event, studentName, course) => {
  if (dataMap.has(studentName)) {
    event.sender.send(
      "student-exists",
      "'" + studentName + "' already exists, choose a different name."
    ); // Send the student name back to the renderer process
    if (debugMode) {
      console.log("DEBUG: " + studentName + " already exists"); // Optional: log for debugging
    }
    return;
  } else {
    dataMap.set(studentName, {
      course: currCourse,
      totalSeconds: 0,
      isRunning: false,
    });
    event.sender.send(
      "student-added",
      studentName,
      dataMap.get(studentName).course,
      dataMap.get(studentName).totalSeconds
    ); // Send the student name, course, and seconds back to the renderer process
    if (debugMode) {
      console.log(
        "DEBUG: " +
          studentName +
          " in " +
          dataMap.get(studentName).course +
          " added"
      ); // Optional: log for debugging
      console.log(
        "DEBUG: New entry " + studentName + ": " + dataMap.get(studentName)
      ); // Optional: log for debugging
    }
  }
});

// Start or stop a student's timer
ipcMain.on("start-stop-timer", (event, studentName) => {
  // User directly stops running timer on current student
  if (dataMap.has(studentName) && dataMap.get(studentName).isRunning) {
    // Stop the timer
    dataMap.get(studentName).isRunning = false;
    prevRunningTimer = "";

    event.sender.send(
      "toggle-timer-text",
      studentName,
      dataMap.get(studentName).isRunning
    );

    if (debugMode) {
      console.log(
        `DEBUG: Direct stop timer ${studentName} ${
          dataMap.get(studentName).isRunning ? "started" : "stopped"
        }
        prevRunningTimer: ${prevRunningTimer}`
      );
    }
  } else {
    // Stop the timer for the previous student if any was running
    if (prevRunningTimer !== "") {
      dataMap.get(prevRunningTimer).isRunning = false;
      event.sender.send(
        "toggle-timer-text",
        prevRunningTimer,
        dataMap.get(prevRunningTimer).isRunning
      );

      if (debugMode) {
        console.log(
          `DEBUG: Indirect Stop timer ${prevRunningTimer} ${
            dataMap.get(prevRunningTimer).isRunning ? "started" : "stopped"
          }
            prevRunningTimer: ${prevRunningTimer}`
        );
      }
    }

    // Start the new student timer
    dataMap.set(studentName, {
      seconds: dataMap.get(studentName)?.seconds || 0,
      isRunning: true,
    });
    // update current student with running timer
    prevRunningTimer = studentName;

    event.sender.send(
      "toggle-timer-text",
      studentName,
      dataMap.get(studentName).isRunning
    );

    if (debugMode) {
      console.log(
        `DEBUG: Start timer ${studentName} ${
          dataMap.get(studentName).isRunning ? "started" : "stopped"
        }
          prevRunningTimer: ${prevRunningTimer}`
      );
    }
  }

  //   // Check if we need to start the global interval
  //   if (!timerInterval) {
  //     startGlobalTimer(event);
  //   }
});

// Start the global interval timer
function startGlobalTimer(event) {
  timerInterval = setInterval(() => {
    let activeTimers = 0;

    dataMap.forEach((timerData, studentName) => {
      if (timerData.isRunning) {
        timerData.seconds += 1;
        activeTimers++;
        event.sender.send("update-timer", studentName, timerData.seconds);
      }
    });

    // If no timers are active, clear the interval
    if (activeTimers === 0) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }, 1000);
}

// Create window when app is ready
app.whenReady().then(createWindow);

// Handle window close events
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
