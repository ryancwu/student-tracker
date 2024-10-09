const { app, BrowserWindow, ipcMain } = require("electron");

let debugMode = true;
let timerInterval = null;
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
ipcMain.on("add-student", (event, studentName, currCourse) => {
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
    event.sender.send("update-students", dataMap); // Send the student name, course, and totalSeconds back to the renderer process
    if (debugMode) {
      console.log(
        "DEBUG: " +
          studentName +
          " in " +
          dataMap.get(studentName).course +
          " added"
      );
      console.log(
        "DEBUG: New entry " + studentName + ": " + dataMap.get(studentName)
      );
      dataMap.forEach((value, key) => {
        console.log(`DEBUG: Key: ${key}, Value:`, value);
      });
    }
  }
});

// Remove student
ipcMain.on("delete-student", (event, studentName) => {
  dataMap.delete(studentName);
  event.sender.send("update-students", dataMap); // Send the student name back to the renderer process
  if (debugMode) {
    console.log("DEBUG: " + studentName + " removed"); // Optional: log for debugging
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
      course: dataMap.get(studentName)?.course || currCourse,
      totalSeconds: dataMap.get(studentName)?.totalSeconds || 0,
      isRunning: true,
    });
    // update current student with running timer
    prevRunningTimer = studentName;

    event.sender.send(
      "toggle-timer-text",
      studentName,
      dataMap.get(studentName).isRunning
    );

    // Check if we need to start the global timer
    if (!timerInterval) {
      startGlobalTimer(event);
    }

    if (debugMode) {
      console.log(
        `DEBUG: Start timer ${studentName} ${
          dataMap.get(studentName).isRunning ? "started" : "stopped"
        }
          prevRunningTimer: ${prevRunningTimer}`
      );
    }
  }
});

function startGlobalTimer(event) {
  timerInterval = setInterval(() => {
    // Check if there's a running timer
    if (prevRunningTimer) {
      // Increment seconds for the currently running timer
      dataMap.get(prevRunningTimer).totalSeconds++;
      // Send the updated seconds to the renderer
      event.sender.send(
        "update-timer",
        prevRunningTimer,
        dataMap.get(prevRunningTimer).totalSeconds
      );
    }
  }, 1000);
}

// Function to stop the global timer when needed
function stopGlobalTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
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
