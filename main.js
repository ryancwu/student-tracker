const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

let debugMode = false;
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

  return win;
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
    event.sender.send("update-students", dataMap, false); // Send the student name, course, and totalSeconds back to the renderer process
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
  event.sender.send("update-students", dataMap, false); // Send the student name back to the renderer process
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

function mapToObject(map) {
  const obj = {};
  map.forEach((value, key) => {
    obj[key] = value; // Set key-value pairs
  });
  return obj;
}

/**
 * Load/Store data from/to data.json
 */
function loadDataFromFile(win) {
  const filePath = path.join(__dirname, "data.json");

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    // Read the file
    const fileContents = fs.readFileSync(filePath, "utf8");

    // Parse the JSON string into an object
    const jsonData = JSON.parse(fileContents);

    // Populate the dataMap
    Object.entries(jsonData).forEach(([key, value]) => {
      dataMap.set(key, value);
    });
    console.log("Raw Data loaded from file:", dataMap); // For debugging
    setAllIsRunningToFalse(); // Set all isRunning to false
    console.log("CleanedData loaded from file:", dataMap); // For debugging
    win.webContents.send("update-students", dataMap, true); // Send the dataMap to the renderer process
  } else {
    console.log("No data file found. Starting with an empty dataMap.");
  }
}

ipcMain.on("write-to-file", (event) => {
  // Convert the Map to an object
  const dataObject = mapToObject(dataMap);

  // Define the file path (for example, to the same directory)
  const filePath = path.join(__dirname, "data.json");
  // Write the object to a JSON file
  fs.writeFile(filePath, JSON.stringify(dataObject, null, 2), (err) => {
    if (err) {
      console.error("Error writing to file:", err);
    } else {
      console.log("Data written successfully to:", filePath);
    }
  });
});

// Function to set all isRunning to false
function setAllIsRunningToFalse() {
  // Update isRunning values
  dataMap.forEach((value, key) => {
    value.isRunning = false; // Set isRunning to false for each student
  });
}

// Hard Import All Data
ipcMain.on("reload-data", (event) => {
  // loadDataFromFile(win);
  event.sender.send("update-students", dataMap, true); // Send the dataMap to the renderer process  
});

// Create window when app is ready
app.whenReady().then(() => {
  const win = createWindow();
  loadDataFromFile(win);
});

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
