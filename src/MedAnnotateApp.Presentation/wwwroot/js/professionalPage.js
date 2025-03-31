document.addEventListener("DOMContentLoaded", function () {
  // Handle logout functionality first - this should work regardless of which page state we're in
  setupLogoutFunctionality();
  
  // Only proceed with the rest of the initialization if we have data (not the "no more data" screen)
  if (window.annotatedMedData) {
    initializeAnnotationTools();
  }
});

// Function to setup logout functionality
function setupLogoutFunctionality() {
  // Setup end button (primary logout button)
  const endButton = document.getElementById("end-button");
  if (endButton) {
    endButton.addEventListener("click", handleLogout);
  }

  // Add event listener for center logout button (when no data is available)
  const endButtonCenter = document.getElementById("end-button-center");
  if (endButtonCenter) {
    endButtonCenter.addEventListener("click", handleLogout);
  }
}

// Shared logout handler function
function handleLogout() {
  // Allow some buffer time for the logout operation to complete
  let redirectTimerSet = false;
  
  // Set a fallback timer to ensure redirection happens regardless of API response
  const redirectTimer = setTimeout(() => {
    if (!redirectTimerSet) {
      redirectTimerSet = true;
      window.location.href = "/Identity/Login";
    }
  }, 2000);
  
  // CRITICAL: Properly check keywordStates before sending the request
  let isAnnotationStarted = false;
  
  // If window.hasAnnotatedCurrentImage is set to true anywhere in the code, use that
  if (window.hasAnnotatedCurrentImage === true) {
    isAnnotationStarted = true;
    console.log("Using window.hasAnnotatedCurrentImage =", isAnnotationStarted);
  } 
  // Otherwise check keywordStates to see if any annotations were made
  else if (window.keywordStatesJson) {
    try {
      // Parse the keywordStates and check if any state is 2 (annotated) or 4 (skipped)
      const parsedStates = JSON.parse(window.keywordStatesJson);
      if (Array.isArray(parsedStates) && 
          (parsedStates.includes(2) || parsedStates.includes(4))) {
        isAnnotationStarted = true;
        console.log("Determined isAnnotationStarted = true from keywordStates:", parsedStates);
      }
    } catch (e) {
      console.error("Error parsing keywordStates:", e);
    }
  }
  
  console.log("Final isAnnotationStarted value:", isAnnotationStarted);
  console.log("Final keywordStatesJson value:", window.keywordStatesJson);
  
  const requestData = {
    isAnnotationStarted: isAnnotationStarted,
    medDataId: window.annotatedMedData ? window.annotatedMedData.id : null,
    keywordStates: window.keywordStatesJson || null,
  };
      
  fetch('/Identity/Logout', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  })
  .then((response) => response.json())
  .then((result) => {
    clearTimeout(redirectTimer);
    redirectTimerSet = true;
    window.location.href = "/Identity/Login";
  })
  .catch((error) => {
    console.error("Error:", error);
    if (!redirectTimerSet) {
      redirectTimerSet = true;
      window.location.href = "/Identity/Login";
    }
  });
}

// Function to initialize the annotation tools and related functionality
function initializeAnnotationTools() {
  // ====================================================
  // Global Elements & Setup
  // ====================================================
  const nextButton = document.getElementById("next-button");
  const skipButton = document.getElementById("skip-button");
  const notPresentButton = document.getElementById("not-present-button");
  const keywords = document.querySelectorAll(".keyword");
  const commentField = document.getElementById("comments");
  const imageContainer = document.getElementById("image-container");

  // Initialize CanvasManager
  const canvasManager = new CanvasManager("mainCanvas", "sourceImage", "canvasContainer");
  const { rectButton, freehandButton, magnifyButton } = canvasManager.createTools(imageContainer);

  // Setup tool button event listeners
  rectButton.addEventListener("click", () => canvasManager.switchMode("rectangle"));
  freehandButton.addEventListener("click", () => canvasManager.switchMode("freehand"));
  magnifyButton.addEventListener("click", function(e) {
    // Simply call the magnifier mode which now handles toggling internally
    canvasManager.switchMode("magnifier");
    e.stopPropagation();
  });

  // ====================================================
  // Global Navigation & Storage Variables
  // ====================================================
  let currentIndex = 0;
  window.keywordStatesJson = window.annotatedMedData.keywordStates;
  let storedAnnotations = new Array(keywords.length).fill(null);
  window.hasAnnotatedCurrentImage = false;
  let keywordStates = JSON.parse(window.keywordStatesJson) || Array.from({ length: keywords.length }, (_, i) => i === 0 ? 3 : 1);
  
  // Initialize currentIndex
  for (let i = 0; i < keywordStates.length; i++) {
    if (keywordStates[i] === 3) {
      currentIndex = i;
      break;
    }
  }

  // ====================================================
  // Timestamp Variables for Current Term
  // ====================================================
  window.tIdentifyStart = Date.now();
  window.tAnnotationStart = 0;

  // Function to safely calculate timestamps
  function calculateTimestamps() {
    let t1 = 0, t2 = 0;
    
    if (window.tAnnotationStart > 0) {
      // Time from starting to look at the image until first annotation
      t1 = Math.max(0, window.tAnnotationStart - window.tIdentifyStart);
      // Time from first annotation until saving
      t2 = Math.max(0, Date.now() - window.tAnnotationStart);
    }
    
    return `(${t1},${t2})`;
  }

  // Also add the function to handleMouseUp in the CanvasManager
  // This can be done by injecting code into window for the CanvasManager to use
  window.setAnnotationStartTime = function() {
    if (window.tAnnotationStart === 0) {
      window.tAnnotationStart = Date.now();
    }
  };

  // ====================================================
  // UI Update Functions
  // ====================================================
  function updateKeywordUI() {
    keywords.forEach((kw, i) => {
      kw.classList.remove("current_keyword", "annotated_keyword", "not_annotated_keyword", "skipped_keyword");
      if (keywordStates[i] === 1) kw.classList.add("not_annotated_keyword");
      else if (keywordStates[i] === 2) kw.classList.add("annotated_keyword");
      else if (keywordStates[i] === 3) kw.classList.add("current_keyword");
      else if (keywordStates[i] === 4) kw.classList.add("skipped_keyword");
    });
  }

  function updateNavigationButtons() {
    /* Previous button removed */
  }

  function updateButtonState() {
    const annotations = canvasManager.getAnnotations();
    
    // Check if we're in the "Next Image" state
    if (nextButton.textContent.trim() === "Next Image") {
      // When we reach the "Next Image" state, always disable the other buttons
      nextButton.disabled = false;
      skipButton.disabled = true;
      notPresentButton.disabled = true;
      return; // Exit early to avoid the other checks
    }
    
    // Normal state - enable/disable based on annotations
    nextButton.disabled = annotations.length === 0;
    
    // Update skip and not present buttons based on annotation state
    if (annotations.length > 0) {
      skipButton.disabled = true;
      notPresentButton.disabled = true;
    } else {
      skipButton.disabled = false;
      notPresentButton.disabled = false;
    }
  }

  function loadAnnotationForCurrentTerm() {
    if (storedAnnotations[currentIndex] && storedAnnotations[currentIndex].annotationState) {
      canvasManager.setAnnotations(storedAnnotations[currentIndex].annotationState.map(obj => ({ ...obj })));
    } else {
      canvasManager.resetAnnotation();
    }
    updateButtonState();
  }

  // ====================================================
  // Button Event Handlers & Sending Annotations
  // ====================================================
  nextButton.addEventListener("click", function () {
    if (nextButton.textContent.trim() === "Save and Next Term") {
      if (canvasManager.getAnnotations().length > 0) {
        window.hasAnnotatedCurrentImage = true;
        const currentKeywordElement = document.getElementById(`keyword-${currentIndex}`);
        
        if (currentKeywordElement) {
          let medData = window.annotatedMedData;
          let boxCoordinates = canvasManager.getAllAnnotationsJSON();
          
          const commentValue = commentField.value.trim();
          
          let hasNext = false;
          let nextIdx = -1;
          
          for (let i = 0; i < keywords.length; i++) {
            if (i > currentIndex && keywordStates[i] === 1) {
              hasNext = true;
              nextIdx = i;
              break;
            }
          }
          
          // Update the current keyword to be annotated (2)
          keywordStates[currentIndex] = 2;
          
          // If there's a next keyword, mark it as current (3)
          if (hasNext) {
            keywordStates[nextIdx] = 3;
            currentIndex = nextIdx; // Update current index immediately
            
            // Clear the canvas immediately for the next term
            canvasManager.resetAnnotation();
          } else {
            nextButton.textContent = "Next Image";
            skipButton.disabled = true;
            notPresentButton.disabled = true;
          }
          
          // Update UI immediately to reflect changes
          updateKeywordUI();
          
          // Create a copy for API
          let statesForAPI = [...keywordStates];
          
          const annotationData = {
            Id: medData.id,
            ImageUrl: medData.imageUrl,
            ImageDescription: medData.imageDescription,
            Sex: medData.sex,
            Age: medData.age,
            SkinTone: medData.skinTone,
            BodyRegion: medData.bodyRegion,
            Diagnosis: medData.diagnosis,
            TreatmentName: medData.treatmentName,
            Speciality: medData.speciality,
            Modality: medData.modality,
            BoxCoordinates: boxCoordinates,
            ExtractedKeyword: currentKeywordElement.textContent,
            Timestamps: calculateTimestamps(),
            PressedButton: "Save and Next Term",
            Comment: commentValue,
            KeywordStates: JSON.stringify(statesForAPI)
          };
          
          fetch(`/MedData/ProcessAnnotatedMedData`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(annotationData),
          })
          .then((response) => response.json())
          .then((result) => {
            if (result.success) {
              storeCurrentAnnotation("Save and Next Term");
              
              // Reset for the next term (ensure canvas is cleared)
              commentField.value = "";
              window.tIdentifyStart = Date.now();
              window.tAnnotationStart = 0;
              
              // Ensure annotations are loaded for the new current term (or empty if none exist)
              loadAnnotationForCurrentTerm();
            } else {
              console.error("Failed to process annotation data.");
            }
          })
          .catch((error) => console.error("Error:", error));
        }
      }
    } else {
      fetch(`/MedData/NextImage?MedDataId=${window.annotatedMedData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          location.reload();
        } else {
          console.error("Failed to process data.");
        }
      })
      .catch((error) => console.error("Error:", error));
    }
  });

  skipButton.addEventListener("click", function () {
    const currentKeywordElement = document.getElementById(`keyword-${currentIndex}`);
    
    if (currentKeywordElement) {
      window.hasAnnotatedCurrentImage = true;
      
      let medData = window.annotatedMedData;
      const commentValue = commentField.value.trim();
      
      let hasNext = false;
      let nextIdx = -1;
      
      for (let i = 0; i < keywords.length; i++) {
        if (i > currentIndex && keywordStates[i] === 1) {
          hasNext = true;
          nextIdx = i;
          break;
        }
      }
      
      // Update the current keyword to be skipped (4)
      keywordStates[currentIndex] = 4;
      
      // If there's a next keyword, mark it as current (3)
      if (hasNext) {
        keywordStates[nextIdx] = 3;
        currentIndex = nextIdx; // Update current index immediately
        
        // Clear the canvas immediately for the next term
        canvasManager.resetAnnotation();
      } else {
        nextButton.textContent = "Next Image";
        skipButton.disabled = true;
        notPresentButton.disabled = true;
      }
      
      // Update UI immediately to reflect changes
      updateKeywordUI();
      
      // Create a copy for API
      let statesForAPI = [...keywordStates];
      
      const annotationData = {
        Id: medData.id,
        ImageUrl: medData.imageUrl,
        ImageDescription: medData.imageDescription,
        Sex: medData.sex,
        Age: medData.age,
        SkinTone: medData.skinTone,
        BodyRegion: medData.bodyRegion,
        Diagnosis: medData.diagnosis,
        TreatmentName: medData.treatmentName,
        Speciality: medData.speciality,
        Modality: medData.modality,
        BoxCoordinates: "",
        ExtractedKeyword: currentKeywordElement.textContent,
        Timestamps: "",
        PressedButton: "Uncertain/Skip",
        Comment: commentValue,
        KeywordStates: JSON.stringify(statesForAPI)
      };
      
      fetch(`/MedData/ProcessAnnotatedMedData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annotationData),
      })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          storeCurrentAnnotation("Uncertain/Skip");
          
          // Reset for the next term (ensure canvas is cleared)
          commentField.value = "";
          window.tIdentifyStart = Date.now();
          window.tAnnotationStart = 0;
          
          // Ensure annotations are loaded for the new current term (or empty if none exist)
          loadAnnotationForCurrentTerm();
        } else {
          console.error("Failed to process annotation data.");
        }
      })
      .catch((error) => console.error("Error:", error));
    }
  });

  notPresentButton.addEventListener("click", function () {
    const currentKeywordElement = document.getElementById(`keyword-${currentIndex}`);
    
    if (currentKeywordElement) {
      window.hasAnnotatedCurrentImage = true;
      
      let medData = window.annotatedMedData;
      const commentValue = commentField.value.trim();
      
      let hasNext = false;
      let nextIdx = -1;
      
      for (let i = 0; i < keywords.length; i++) {
        if (i > currentIndex && keywordStates[i] === 1) {
          hasNext = true;
          nextIdx = i;
          break;
        }
      }
      
      // Mark current keyword as not present (1)
      keywordStates[currentIndex] = 1;
      
      // If there's a next keyword, mark it as current (3)
      if (hasNext) {
        keywordStates[nextIdx] = 3;
        currentIndex = nextIdx; // Update current index immediately
        
        // Clear the canvas immediately for the next term
        canvasManager.resetAnnotation();
      } else {
        nextButton.textContent = "Next Image";
        skipButton.disabled = true;
        notPresentButton.disabled = true;
      }
      
      // Update UI immediately to reflect changes
      updateKeywordUI();
      
      // Create a copy for API
      let statesForAPI = [...keywordStates];
      
      const annotationData = {
        Id: medData.id,
        ImageUrl: medData.imageUrl,
        ImageDescription: medData.imageDescription,
        Sex: medData.sex,
        Age: medData.age,
        SkinTone: medData.skinTone,
        BodyRegion: medData.bodyRegion,
        Diagnosis: medData.diagnosis,
        TreatmentName: medData.treatmentName,
        Speciality: medData.speciality,
        Modality: medData.modality,
        BoxCoordinates: "",
        ExtractedKeyword: currentKeywordElement.textContent,
        Timestamps: "",
        PressedButton: "Not Visible/Abstract",
        Comment: commentValue,
        KeywordStates: JSON.stringify(statesForAPI)
      };
      
      fetch(`/MedData/ProcessAnnotatedMedData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annotationData),
      })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          storeCurrentAnnotation("Not Visible/Abstract");
          
          // Reset for the next term (ensure canvas is cleared)
          commentField.value = "";
          window.tIdentifyStart = Date.now();
          window.tAnnotationStart = 0;
          
          // Ensure annotations are loaded for the new current term (or empty if none exist)
          loadAnnotationForCurrentTerm();
        } else {
          console.error("Failed to process annotation data.");
        }
      })
      .catch((error) => console.error("Error:", error));
    }
  });

  function storeCurrentAnnotation(pressedButton) {
    const currentKeywordElement = document.getElementById(`keyword-${currentIndex}`);
    if (currentKeywordElement) {
      let medData = window.annotatedMedData;
      let boxCoordinates = "";
      let timestamps = "";
      const commentValue = commentField.value.trim();
      if (pressedButton === "Save and Next Term") {
        boxCoordinates = canvasManager.getAllAnnotationsJSON();
        timestamps = calculateTimestamps();
      }
      storedAnnotations[currentIndex] = {
        annotationState: canvasManager.getAnnotations().map((a) => Object.assign({}, a)),
        BoxCoordinates: boxCoordinates,
        Timestamps: timestamps,
        Id: medData.id,
        ImageUrl: medData.imageUrl,
        ImageDescription: medData.imageDescription,
        Sex: medData.sex,
        Age: medData.age,
        SkinTone: medData.skinTone,
        BodyRegion: medData.bodyRegion,
        Diagnosis: medData.diagnosis,
        TreatmentName: medData.treatmentName,
        Speciality: medData.speciality,
        Modality: medData.modality,
        ExtractedKeyword: currentKeywordElement.textContent,
        PressedButton: pressedButton,
        Comment: commentValue,
      };
    }
  }

  // Initialize UI
  updateKeywordUI();
  updateNavigationButtons();

  // Add event listener to update button state when annotations change
  canvasManager.onAnnotationsChange = function() {
    updateButtonState();
    
    // Enable Save and Next button as soon as an annotation is added
    if (canvasManager.getAnnotations().length > 0) {
      nextButton.disabled = false;
    }
  };
}

