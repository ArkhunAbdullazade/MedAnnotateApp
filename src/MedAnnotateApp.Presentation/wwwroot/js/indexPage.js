document.addEventListener("DOMContentLoaded", function () {
  // ====================================================
  // Global Elements & Setup
  // ====================================================
  const canvas = document.getElementById("mainCanvas");
  const ctx = canvas.getContext("2d");
  const sourceImage = document.getElementById("sourceImage");
  const container = document.getElementById("canvasContainer");
  const nextButton = document.getElementById("next-button"); // "Save and Next Term" / "Next Image"
  const skipButton = document.getElementById("skip-button"); // "Uncertain/Skip"
  const notPresentButton = document.getElementById("not-present-button"); // "Not Visible/Abstract"
  const endButton = document.getElementById("end-button");
  const keywords = document.querySelectorAll(".keyword");
  const commentField = document.getElementById("comments");

  // ====================================================
  // Create tools container and buttons
  // ====================================================
  const imageContainer = document.getElementById("image-container");
  
  // Create tools container
  const toolsContainer = document.createElement("div");
  toolsContainer.className = "tools-container";
  
  // Create rectangle button
  const rectButton = document.createElement("div");
  rectButton.className = "tool-button active"; // Active by default
  rectButton.id = "rectModeButton";
  rectButton.title = "Rectangle Mode";
  
  const rectIcon = document.createElement("img");
  rectIcon.src = "../images/rectangle-icon.png";
  rectIcon.alt = "Rectangle Mode";
  
  rectButton.appendChild(rectIcon);
  
  // Create freehand button
  const freehandButton = document.createElement("div");
  freehandButton.className = "tool-button";
  freehandButton.id = "freehandModeButton";
  freehandButton.title = "Freehand Mode";
  
  const penIcon = document.createElement("img");
  penIcon.src = "../images/pen-icon.png";
  penIcon.alt = "Freehand Mode";
  
  freehandButton.appendChild(penIcon);
  
  // Create magnify button
  const magnifyButton = document.createElement("div");
  magnifyButton.className = "tool-button";
  magnifyButton.id = "magnifyButton";
  magnifyButton.title = "Magnifier Tool";
  
  const magnifyIcon = document.createElement("img");
  magnifyIcon.src = "../images/magnifying-glass.png";
  magnifyIcon.alt = "Magnifier Tool";
  
  magnifyButton.appendChild(magnifyIcon);
  
  // Add all buttons to tools container
  toolsContainer.appendChild(rectButton);
  toolsContainer.appendChild(freehandButton);
  toolsContainer.appendChild(magnifyButton);
  
  // Add tools container to the image container (not annotation section)
  // This allows tools to be positioned relative to the image container
  imageContainer.appendChild(toolsContainer);

  // Global mode variable for new annotations ("rectangle" or "freehand")
  let currentAnnotationMode = "rectangle"; // default
  function switchMode(newMode) {
    if (newMode !== currentAnnotationMode) {
      currentAnnotationMode = newMode;
      resetAnnotation(); // Clears all existing annotations when switching
      drawCanvas();
      
      // Update active button styling
      if (newMode === "rectangle") {
        rectButton.classList.add("active");
        freehandButton.classList.remove("active");
      } else if (newMode === "freehand") {
        freehandButton.classList.add("active");
        rectButton.classList.remove("active");
      }
    }
  }
  
  rectButton.addEventListener("click", () => switchMode("rectangle"));
  freehandButton.addEventListener("click", () => switchMode("freehand"));
  magnifyButton.addEventListener("click", function(e) {
    if (magnifierActive) {
      hideLens();
      magnifyButton.classList.remove("active");
    } else {
      showLens();
      magnifyButton.classList.add("active");
    }
    e.stopPropagation();
  });

  // ====================================================
  // Global Navigation & Storage Variables
  // ====================================================
  let currentIndex = 0; // Index of the current keyword
  let keywordStatesJson = window.annotatedMedData.keywordStates;
  let storedAnnotations = new Array(keywords.length).fill(null);
  // Add a flag to track if any annotations have been made for this image
  let hasAnnotatedCurrentImage = false;
  // Keyword states: 1 = not annotated, 2 = annotated, 3 = current, 4 = skipped.
  let keywordStates = JSON.parse(keywordStatesJson) || Array.from({ length: keywords.length }, (_, i) =>
    i === 0 ? 3 : 1
  );
  
  // Initialize currentIndex by finding which keyword is marked as current (state 3)
  for (let i = 0; i < keywordStates.length; i++) {
    if (keywordStates[i] === 3) {
      currentIndex = i;
      break;
    }
  }
  
  function updateKeywordUI() {
    keywords.forEach((kw, i) => {
      kw.classList.remove(
        "current_keyword",
        "annotated_keyword",
        "not_annotated_keyword",
        "skipped_keyword"
      );
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
    if (nextButton.textContent.trim() === "Next Image") {
      nextButton.disabled = false;
    } else {
      nextButton.disabled = annotations.length > 0 ? false : true;
    }
  }
  updateKeywordUI();
  updateNavigationButtons();

  // ====================================================
  // Timestamp Variables for Current Term
  // ====================================================
  let tIdentifyStart = Date.now();
  let tAnnotationStart = 0;

  // ====================================================
  // Annotation Variables for Current Term
  // ====================================================
  let annotations = []; // Array holding saved annotation objects
  let selectedAnnotation = null; // Currently selected shape
  // currentAction: transformation during mouse events ("none", "draw", "move", "resize", "rotate")
  let currentAction = "none";
  let offset = { x: 0, y: 0 };
  let activeHandle = null;
  let resizingFixedCorner = null;
  let originalMouseAngle = 0,
    originalAnnotationRotation = 0;
  // For rectangle mode:
  let rectStart = null;
  // For freehand mode:
  let freehandPoints = [];
  // currentDrawingAnnotation holds the shape while drawing
  let currentDrawingAnnotation = null;
  let startToDrawEnd = 0;
  let isFirstDraw = true;

  // resetDrawingState resets only temporary drawing variables so you can accumulate multiple shapes.
  function resetDrawingState() {
    currentDrawingAnnotation = null;
    rectStart = null;
    freehandPoints = [];
    currentAction = "none";
    updateButtonState();
  }
  // resetAnnotation clears all annotations for a new term.
  function resetAnnotation() {
    annotations = [];
    selectedAnnotation = null;
    currentAction = "none";
    rectStart = null;
    freehandPoints = [];
    currentDrawingAnnotation = null;
    drawCanvas();
    updateButtonState();
    isFirstDraw = true;
    tAnnotationStart = 0;
  }
  function loadAnnotationForCurrentTerm() {
    if (
      storedAnnotations[currentIndex] &&
      storedAnnotations[currentIndex].annotationState
    ) {
      annotations = storedAnnotations[currentIndex].annotationState.map(
        (obj) => ({ ...obj })
      );
      selectedAnnotation = annotations.length ? annotations[0] : null;
    } else {
      annotations = [];
      selectedAnnotation = null;
    }
    drawCanvas();
    updateButtonState();
  }
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  // ====================================================
  // Canvas & Image Sizing
  // ====================================================
  sourceImage.onload = function () {
    // Calculate the image aspect ratio
    const imgRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    
    // Get the container dimensions
    const imageContainer = document.getElementById("image-container");
    
    // Fixed height of exactly 430px
    let newHeight = 430; 
    let newWidth = Math.floor(newHeight * imgRatio);
    
    // Make sure we don't exceed the container width, with a margin
    const maxWidth = imageContainer.parentElement.clientWidth - 100; // More margin (100px)
    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      // Keep height at exactly 430px regardless
      newHeight = 430;
    }
    
    // Set canvas dimensions
    canvas.height = newHeight;
    canvas.width = newWidth;
    
    // Set canvas container to exact same size as canvas
    const canvasContainer = document.getElementById("canvasContainer");
    canvasContainer.style.width = newWidth + "px";
    canvasContainer.style.height = newHeight + "px";
    
    // Set the image container to exactly match the canvas dimensions
    imageContainer.style.width = newWidth + "px";
    imageContainer.style.height = newHeight + "px";
    
    // Draw the image
    drawCanvas();
  };
  if (sourceImage.complete) sourceImage.onload();

  // ====================================================
  // Drawing Functions
  // ====================================================
  function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    annotations.forEach((ann) =>
      drawAnnotation(ann, ann === selectedAnnotation)
    );
    if (currentAction === "draw" && currentDrawingAnnotation) {
      drawAnnotation(currentDrawingAnnotation, true);
    }
  }
  // drawAnnotation supports both rectangle and freehand.
  function drawAnnotation(ann, isSelected) {
    if (ann.type === "rectangle") {
      ctx.save();
      ctx.translate(ann.cx, ann.cy);
      ctx.rotate(ann.rotation);
      ctx.lineWidth = 2;
      ctx.strokeStyle = isSelected ? "red" : "blue";
      ctx.strokeRect(-ann.width / 2, -ann.height / 2, ann.width, ann.height);
      ctx.restore();
    } else if (ann.type === "freehand") {
      ctx.beginPath();
      ann.points.forEach((pt, index) => {
        if (index === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.lineWidth = 2;
      ctx.strokeStyle = isSelected ? "red" : "blue";
      ctx.stroke();
    }
    // Draw delete handle only if the shape is selected.
    if (isSelected) {
      if (ann.type === "rectangle") {
        const handles = getAnnotationHandles(ann);
        const size = 8;
        ctx.fillStyle = "white";
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ["tl", "tr", "bl", "br"].forEach((key) => {
          let h = handles[key];
          ctx.fillRect(h.x - size / 2, h.y - size / 2, size, size);
          ctx.strokeRect(h.x - size / 2, h.y - size / 2, size, size);
        });
        const rHandle = handles.rotate;
        ctx.beginPath();
        ctx.arc(rHandle.x, rHandle.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.stroke();
        const dHandle = handles.delete;
        ctx.fillStyle = "white";
        ctx.fillRect(dHandle.x - 6, dHandle.y - 6, 12, 12);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.strokeRect(dHandle.x - 6, dHandle.y - 6, 12, 12);
        ctx.fillStyle = "black";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("X", dHandle.x, dHandle.y);
      } else if (ann.type === "freehand") {
        // For freehand shapes, compute the bounding box and draw a delete handle.
        const bbox = getBoundingBox(ann.points);
        const handleX = bbox.maxX + 5;
        const handleY = bbox.minY - 5;
        ctx.fillStyle = "white";
        ctx.fillRect(handleX, handleY, 12, 12);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.strokeRect(handleX, handleY, 12, 12);
        ctx.fillStyle = "black";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("X", handleX + 6, handleY + 6);
      }
    }
  }
  // Helper: for rectangles, get transformation handles.
  function getAnnotationHandles(ann) {
    const hw = ann.width / 2,
      hh = ann.height / 2;
    const localHandles = {
      tl: { x: -hw, y: -hh },
      tr: { x: hw, y: -hh },
      bl: { x: -hw, y: hh },
      br: { x: hw, y: hh },
      rotate: { x: 0, y: -hh - 30 },
      delete: { x: hw + 10, y: -hh - 10 },
    };
    const handles = {};
    for (let key in localHandles) {
      const local = localHandles[key];
      const cos = Math.cos(ann.rotation),
        sin = Math.sin(ann.rotation);
      handles[key] = {
        x: ann.cx + local.x * cos - local.y * sin,
        y: ann.cy + local.x * sin + local.y * cos,
      };
    }
    return handles;
  }
  // Helper: compute bounding box for an array of points.
  function getBoundingBox(points) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    points.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
    return { minX, minY, maxX, maxY };
  }
  function isPointInAnnotation(ann, x, y) {
    if (ann.type === "rectangle") {
      const dx = x - ann.cx,
        dy = y - ann.cy;
      const cos = Math.cos(-ann.rotation),
        sin = Math.sin(-ann.rotation);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      return (
        Math.abs(localX) <= ann.width / 2 && Math.abs(localY) <= ann.height / 2
      );
    } else if (ann.type === "freehand") {
      for (let i = 0; i < ann.points.length - 1; i++) {
        if (distanceToSegment({ x, y }, ann.points[i], ann.points[i + 1]) < 5) {
          return true;
        }
      }
      return false;
    }
  }
  function isPointNearHandle(point, handle, radius = 8) {
    const dx = point.x - handle.x,
      dy = point.y - handle.y;
    return Math.hypot(dx, dy) < radius;
  }
  function distanceToSegment(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
  }
  function getAnnotationCornersOriginal(ann) {
    if (ann.type === "rectangle") {
      const hw = ann.width / 2,
        hh = ann.height / 2;
      function transform(local) {
        const xCanvas =
          ann.cx +
          local.x * Math.cos(ann.rotation) -
          local.y * Math.sin(ann.rotation);
        const yCanvas =
          ann.cy +
          local.x * Math.sin(ann.rotation) +
          local.y * Math.cos(ann.rotation);
        const scaleX = sourceImage.naturalWidth / canvas.width;
        const scaleY = sourceImage.naturalHeight / canvas.height;
        return [Math.round(xCanvas * scaleX), Math.round(yCanvas * scaleY)];
      }
      return [
        transform({ x: -hw, y: -hh }),
        transform({ x: hw, y: -hh }),
        transform({ x: hw, y: hh }),
        transform({ x: -hw, y: hh }),
      ];
    } else if (ann.type === "freehand") {
      const scaleX = sourceImage.naturalWidth / canvas.width;
      const scaleY = sourceImage.naturalHeight / canvas.height;
      return ann.points.map((pt) => [
        Math.round(pt.x * scaleX),
        Math.round(pt.y * scaleY),
      ]);
    }
  }
  function getAllAnnotationsJSON() {
    const validAnnotations = annotations.filter(
      (ann) =>
        ann &&
        ((ann.type === "rectangle" && ann.width > 0 && ann.height > 0) ||
          (ann.type === "freehand" && ann.points && ann.points.length > 1))
    );
    const arr = validAnnotations.map((ann) =>
      getAnnotationCornersOriginal(ann)
    );
    return JSON.stringify(arr);
  }

  // ====================================================
  // Ramer–Douglas–Peucker for Freehand Simplification
  // ====================================================
  function rdp(points, epsilon) {
    if (points.length < 3) return points;
    let dmax = 0;
    let index = 0;
    const start = points[0];
    const end = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpendicularDistance(points[i], start, end);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }
    if (dmax > epsilon) {
      const recResults1 = rdp(points.slice(0, index + 1), epsilon);
      const recResults2 = rdp(points.slice(index), epsilon);
      return recResults1.slice(0, -1).concat(recResults2);
    } else {
      return [start, end];
    }
  }
  function perpendicularDistance(p, p1, p2) {
    const num = Math.abs(
      (p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x
    );
    const den = Math.hypot(p2.y - p1.y, p2.x - p1.x);
    return num / den;
  }

  // ====================================================
  // Canvas Mouse Event Handlers
  // ====================================================
  canvas.addEventListener("mousedown", function (e) {
    if (magnifierActive) return;
    
    const rect = canvas.getBoundingClientRect();
    // Get the relative position within the canvas
    const mouseX = clamp(e.clientX - rect.left, 0, canvas.width - 1);
    const mouseY = clamp(e.clientY - rect.top, 0, canvas.height - 1);
    
    startX = mouseX;
    startY = mouseY;
    
    if (currentAction === "none" && tAnnotationStart === 0) {
      tAnnotationStart = Date.now();
      console.log(
        "t1 (Identification Time):",
        tAnnotationStart - tIdentifyStart,
        "ms"
      );
    }
    // If a shape is selected, check if the click is on its delete handle.
    if (selectedAnnotation) {
      if (selectedAnnotation.type === "rectangle") {
        const handles = getAnnotationHandles(selectedAnnotation);
        if (isPointNearHandle({ x: mouseX, y: mouseY }, handles.delete)) {
          annotations = annotations.filter((ann) => ann !== selectedAnnotation);
          selectedAnnotation = null;
          drawCanvas();
          updateButtonState();
          return;
        }
      } else if (selectedAnnotation.type === "freehand") {
        const bbox = getBoundingBox(selectedAnnotation.points);
        const handleX = bbox.maxX + 5;
        const handleY = bbox.minY - 5;
        if (
          mouseX >= handleX &&
          mouseX <= handleX + 12 &&
          mouseY >= handleY &&
          mouseY <= handleY + 12
        ) {
          annotations = annotations.filter((ann) => ann !== selectedAnnotation);
          selectedAnnotation = null;
          drawCanvas();
          updateButtonState();
          return;
        }
      }
      // Check transformation handles (only implemented for rectangles)
      if (selectedAnnotation.type === "rectangle") {
        const handles = getAnnotationHandles(selectedAnnotation);
        if (isPointNearHandle({ x: mouseX, y: mouseY }, handles.rotate)) {
          currentAction = "rotate";
          originalMouseAngle = Math.atan2(
            mouseY - selectedAnnotation.cy,
            mouseX - selectedAnnotation.cx
          );
          originalAnnotationRotation = selectedAnnotation.rotation;
          return;
        }
        for (let key of ["tl", "tr", "bl", "br"]) {
          if (isPointNearHandle({ x: mouseX, y: mouseY }, handles[key])) {
            currentAction = "resize";
            activeHandle = key;
            const opposite = { tl: "br", tr: "bl", bl: "tr", br: "tl" }[key];
            resizingFixedCorner = handles[opposite];
            return;
          }
        }
      }
      if (isPointInAnnotation(selectedAnnotation, mouseX, mouseY)) {
        currentAction = "move";
        offset.x = mouseX - selectedAnnotation.cx;
        offset.y = mouseY - selectedAnnotation.cy;
        return;
      }
    }
    let found = false;
    for (let i = annotations.length - 1; i >= 0; i--) {
      if (isPointInAnnotation(annotations[i], mouseX, mouseY)) {
        selectedAnnotation = annotations[i];
        currentAction = "move";
        offset.x = mouseX - selectedAnnotation.cx;
        offset.y = mouseY - selectedAnnotation.cy;
        found = true;
        drawCanvas();
        break;
      }
    }
    if (found) return;
    // Begin new drawing based on currentAnnotationMode:
    currentAction = "draw";
    if (currentAnnotationMode === "rectangle") {
      rectStart = { x: mouseX, y: mouseY };
      currentDrawingAnnotation = {
        type: "rectangle",
        cx: mouseX,
        cy: mouseY,
        width: 0,
        height: 0,
        rotation: 0,
      };
      selectedAnnotation = currentDrawingAnnotation;
    } else if (currentAnnotationMode === "freehand") {
      freehandPoints = [{ x: mouseX, y: mouseY }];
      currentDrawingAnnotation = {
        type: "freehand",
        points: freehandPoints,
      };
      selectedAnnotation = currentDrawingAnnotation;
    }
    drawCanvas();
  });

  canvas.addEventListener("mousemove", function (e) {
    if (magnifierActive) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = clamp(e.clientX - rect.left, 0, canvas.width - 1);
    const mouseY = clamp(e.clientY - rect.top, 0, canvas.height - 1);
    
    if (currentAction === "draw") {
      if (currentAnnotationMode === "rectangle" && currentDrawingAnnotation) {
        // Calculate new center point and dimensions
        currentDrawingAnnotation.cx = (rectStart.x + mouseX) / 2;
        currentDrawingAnnotation.cy = (rectStart.y + mouseY) / 2;
        currentDrawingAnnotation.width = Math.abs(mouseX - rectStart.x);
        currentDrawingAnnotation.height = Math.abs(mouseY - rectStart.y);
        
        // Apply boundary check during drawing
        currentDrawingAnnotation = boundaryCheck(currentDrawingAnnotation);
        
        drawCanvas();
      } else if (
        currentAnnotationMode === "freehand" &&
        currentDrawingAnnotation
      ) {
        // Add point to freehand path
        freehandPoints.push({ x: mouseX, y: mouseY });
        
        drawCanvas();
      }
    } else if (currentAction === "move" && selectedAnnotation) {
      // Update position and apply boundary check
      selectedAnnotation.cx = mouseX - offset.x;
      selectedAnnotation.cy = mouseY - offset.y;
      
      // Apply boundary check during move
      selectedAnnotation = boundaryCheck(selectedAnnotation);
      
      drawCanvas();
    } else if (currentAction === "resize" && selectedAnnotation) {
      // Calculate new dimensions
      let newCX = (resizingFixedCorner.x + mouseX) / 2;
      let newCY = (resizingFixedCorner.y + mouseY) / 2;
      let dx = mouseX - newCX;
      let dy = mouseY - newCY;
      let cos = Math.cos(-selectedAnnotation.rotation);
      let sin = Math.sin(-selectedAnnotation.rotation);
      let localX = dx * cos - dy * sin;
      let localY = dx * sin + dy * cos;
      
      // Update annotation
      selectedAnnotation.cx = newCX;
      selectedAnnotation.cy = newCY;
      selectedAnnotation.width = Math.abs(localX) * 2;
      selectedAnnotation.height = Math.abs(localY) * 2;
      
      // Apply boundary check during resize
      selectedAnnotation = boundaryCheck(selectedAnnotation);
      
      drawCanvas();
    } else if (currentAction === "rotate" && selectedAnnotation) {
      let angle = Math.atan2(
        mouseY - selectedAnnotation.cy,
        mouseX - selectedAnnotation.cx
      );
      selectedAnnotation.rotation =
        originalAnnotationRotation + (angle - originalMouseAngle);
      
      // Apply boundary check during rotation
      selectedAnnotation = boundaryCheck(selectedAnnotation);
      
      drawCanvas();
    }
  });

  canvas.addEventListener("mouseup", function (e) {
    if (magnifierActive) return;
    
    if (currentAction === "draw") {
      if (currentAnnotationMode === "freehand" && currentDrawingAnnotation) {
        // First simplify freehand points using RDP algorithm
        const tolerance = 4; // adjust as needed
        let simplified = rdp(freehandPoints, tolerance);
        
        // Auto-close shape: if last point is close to the first (within 10 pixels)
        if (simplified.length > 2) {
          const first = simplified[0];
          const last = simplified[simplified.length - 1];
          if (Math.hypot(last.x - first.x, last.y - first.y) < 10) {
            simplified[simplified.length - 1] = { ...first };
          } else {
            simplified.push({ ...first });
          }
        }
        
        // Normalize to exactly 10 points if there are more than 10
        if (simplified.length > 10) {
          simplified = normalizeToTenPoints(simplified);
        }
        
        currentDrawingAnnotation.points = simplified;
        
        // Apply boundary check before adding to annotations
        currentDrawingAnnotation = boundaryCheck(currentDrawingAnnotation);
        
        annotations.push(currentDrawingAnnotation);
        currentDrawingAnnotation = null;
        if (tAnnotationStart === 0) tAnnotationStart = Date.now();
      } else if (
        currentAnnotationMode === "rectangle" &&
        currentDrawingAnnotation
      ) {
        // Apply boundary check before adding to annotations
        currentDrawingAnnotation = boundaryCheck(currentDrawingAnnotation);
        
        annotations.push(currentDrawingAnnotation);
        currentDrawingAnnotation = null;
        if (tAnnotationStart === 0) tAnnotationStart = Date.now();
      }
    }

    currentAction = "none";
    drawCanvas();
    updateButtonState();
  });

  // ====================================================
  // Magnifier Section (Updated to match new button)
  // ====================================================
  let magnifierActive = false;
  let lens;
  let _lensSize = 150;
  const _zoomFactor = 4;
  let draggingLens = false;
  let isResizingLens = false;
  let lensOffset = { x: 0, y: 0 };
  let initialLensSize = 150;
  let initialMousePos = { x: 0, y: 0 };
  const resizeMargin = 20;
  function updateLensCursor(e) {
    if (!lens) return;
    const lensRect = lens.getBoundingClientRect();
    const x = e.clientX - lensRect.left;
    const y = e.clientY - lensRect.top;
    lens.style.cursor =
      x < resizeMargin ||
      x > lensRect.width - resizeMargin ||
      y < resizeMargin ||
      y > lensRect.height - resizeMargin
        ? "nwse-resize"
        : "move";
  }
  
  function showLens() {
    // Clean up any existing lens
    if (lens) {
      document.body.removeChild(lens);
      lens = null;
    }
    
    // Create new lens
    lens = document.createElement("div");
    lens.className = "lens";
    
    // Create canvas for the lens
    const lensCanvas = document.createElement("canvas");
    lensCanvas.width = _lensSize;
    lensCanvas.height = _lensSize;
    lens.appendChild(lensCanvas);
    lens.ctx = lensCanvas.getContext("2d");
    
    // Position lens in the center of the canvas initially
    const canvasRect = canvas.getBoundingClientRect();
    const lensLeft = canvasRect.left + (canvasRect.width / 2) - (_lensSize / 2);
    const lensTop = canvasRect.top + (canvasRect.height / 2) - (_lensSize / 2);
    
    lens.style.width = _lensSize + "px";
    lens.style.height = _lensSize + "px";
    lens.style.left = lensLeft + "px";
    lens.style.top = lensTop + "px";
    document.body.appendChild(lens);
    
    // Set up mouse event listeners
    lens.addEventListener("mousemove", updateLensCursor);
    
    lens.addEventListener("mousedown", function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const lensRect = lens.getBoundingClientRect();
      const x = e.clientX - lensRect.left;
      const y = e.clientY - lensRect.top;
      
      // Check if we're resizing or moving
      if (x < resizeMargin || x > lensRect.width - resizeMargin || 
          y < resizeMargin || y > lensRect.height - resizeMargin) {
        isResizingLens = true;
        initialLensSize = _lensSize;
        initialMousePos = { x: e.clientX, y: e.clientY };
      } else {
        draggingLens = true;
        lensOffset = { 
          x: e.clientX - lensRect.left, 
          y: e.clientY - lensRect.top 
        };
      }
    });
    
    // Global event handlers for mouseup and mousemove
    const moveHandler = function(e) {
      if (isResizingLens) {
        // Handle resizing
        const dx = e.clientX - initialMousePos.x;
        const dy = e.clientY - initialMousePos.y;
        const delta = Math.max(dx, dy);
        let newSize = initialLensSize + delta;
        
        // Limit size
        newSize = Math.max(75, Math.min(newSize, 200));
        _lensSize = newSize;
        
        lens.style.width = _lensSize + "px";
        lens.style.height = _lensSize + "px";
        
        const lensCanvas = lens.querySelector("canvas");
        lensCanvas.width = _lensSize;
        lensCanvas.height = _lensSize;
        
        updateLens();
      } else if (draggingLens) {
        // Handle dragging - constrain to canvas boundaries
        const canvasRect = canvas.getBoundingClientRect();
        
        let newLeft = e.clientX - lensOffset.x;
        let newTop = e.clientY - lensOffset.y;
        
        // Keep lens within canvas bounds
        newLeft = Math.max(
          canvasRect.left, 
          Math.min(newLeft, canvasRect.right - _lensSize)
        );
        
        newTop = Math.max(
          canvasRect.top, 
          Math.min(newTop, canvasRect.bottom - _lensSize)
        );
        
        lens.style.left = newLeft + "px";
        lens.style.top = newTop + "px";
        
        updateLens();
      }
    };
    
    const upHandler = function() {
      draggingLens = false;
      isResizingLens = false;
    };
    
    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", upHandler);
    
    // Store event handlers to remove them later
    lens.moveHandler = moveHandler;
    lens.upHandler = upHandler;
    
    // Activate magnifier
    magnifierActive = true;
    magnifyButton.classList.add("active");
    updateLens();
  }
  function hideLens() {
    if (lens) {
      // Remove event listeners
      document.removeEventListener("mousemove", lens.moveHandler);
      document.removeEventListener("mouseup", lens.upHandler);
      
      // Remove the lens from DOM
      lens.style.display = "none";
      document.body.removeChild(lens);
      lens = null;
    }
    
    magnifierActive = false;
    magnifyButton.classList.remove("active");
  }
  function updateLens() {
    if (!lens) return;
    
    // Get positions
    const lensRect = lens.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate center of lens relative to canvas
    const relativeLensX = (lensRect.left + lensRect.width/2) - canvasRect.left;
    const relativeLensY = (lensRect.top + lensRect.height/2) - canvasRect.top;
    
    // Check if lens is far outside canvas - don't update if too far
    const buffer = _lensSize;
    if (relativeLensX < -buffer || relativeLensX > canvasRect.width + buffer ||
        relativeLensY < -buffer || relativeLensY > canvasRect.height + buffer) {
      return;
    }
    
    // Calculate source area on canvas to zoom
    const scale = 1 / _zoomFactor;
    const sourceWidth = _lensSize * scale;
    const sourceHeight = _lensSize * scale;
    
    // Source coordinates on canvas
    let sourceX = relativeLensX - sourceWidth/2;
    let sourceY = relativeLensY - sourceHeight/2;
    
    // Clamp source area to canvas bounds
    sourceX = Math.max(0, Math.min(sourceX, canvasRect.width - sourceWidth));
    sourceY = Math.max(0, Math.min(sourceY, canvasRect.height - sourceHeight));
    
    // Get lens canvas and draw zoomed content
    const lensCanvas = lens.querySelector("canvas");
    const lensCtx = lensCanvas.getContext("2d");
    
    // Clear lens canvas
    lensCtx.clearRect(0, 0, _lensSize, _lensSize);
    
    try {
      // Draw zoomed image
      lensCtx.drawImage(
        canvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        _lensSize,
        _lensSize
      );
      
      // Add crosshair to center
      const center = _lensSize / 2;
      lensCtx.strokeStyle = "rgba(255,0,0,0.7)";
      lensCtx.lineWidth = 1;
      
      // Horizontal line
      lensCtx.beginPath();
      lensCtx.moveTo(center - 10, center);
      lensCtx.lineTo(center + 10, center);
      lensCtx.stroke();
      
      // Vertical line
      lensCtx.beginPath();
      lensCtx.moveTo(center, center - 10);
      lensCtx.lineTo(center, center + 10);
      lensCtx.stroke();
    } catch (e) {
      console.error("Error updating lens:", e);
    }
  }

  // ====================================================
  // Button Event Handlers & Sending Annotations
  // ====================================================
  nextButton.addEventListener("click", function () {
    if (nextButton.textContent.trim() === "Save and Next Term") {
      if (annotations.length > 0) {
        // Set the flag to indicate annotations have been made
        hasAnnotatedCurrentImage = true;
        
        // Use the current index to identify the current keyword
        const currentKeywordElement = document.getElementById(`keyword-${currentIndex}`);
        
        if (currentKeywordElement) {
          // Step 1: Get all current state info and references
          let medData = window.annotatedMedData;
          let boxCoordinates = getAllAnnotationsJSON();
          let t2 = Date.now() - tAnnotationStart;
          let t1 = tAnnotationStart - tIdentifyStart;
          let timestamps = `(${t1},${t2})`;
          const commentValue = commentField.value.trim();
          
          // Find the next unannotated keyword (state 1)
          let hasNext = false;
          let nextIdx = -1;
          
          for (let i = 0; i < keywords.length; i++) {
            if (i > currentIndex && keywordStates[i] === 1) {
              hasNext = true;
              nextIdx = i;
              break;
            }
          }
          
          // Step 2: Prepare state change data (but don't apply yet)
          let statesForAPI = [...keywordStates];
          statesForAPI[currentIndex] = 2; // Mark current as annotated
          
          // For API prep: Set next keyword as current if it exists
          if (hasNext) {
            statesForAPI[nextIdx] = 3;
          }
          
          // Create data object for API
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
            Timestamps: timestamps,
            PressedButton: "Save and Next Term",
            Comment: commentValue,
            KeywordStates: JSON.stringify(statesForAPI)
          };
          
          // Step 3: Send to API
          fetch(`/MedData/ProcessAnnotatedMedData`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(annotationData),
          })
          .then((response) => response.json())
          .then((result) => {
            if (result.success) {
              // Step 4: After API success, apply state changes to UI
              storeCurrentAnnotation("Save and Next Term");
              
              // Apply the same state changes we sent to API
              keywordStates[currentIndex] = 2; // Mark current as annotated
              
              if (hasNext) {
                keywordStates[nextIdx] = 3; // Set next as current
                currentIndex = nextIdx; // Update the current index
              } else {
                nextButton.textContent = "Next Image";
                skipButton.disabled = true;
                notPresentButton.disabled = true;
              }
              
              // Update UI with the new states
              updateKeywordUI();
              
              // Reset for next term
              resetAnnotation();
              loadAnnotationForCurrentTerm();
              commentField.value = "";
              tIdentifyStart = Date.now();
              tAnnotationStart = 0;
            } else {
              console.error("Failed to process annotation data.");
            }
          })
          .catch((error) => console.error("Error:", error));
        }
      }
    } else {
      // This is the "Next Image" case
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
    // Use the current index to identify the current keyword
    const currentKeywordElement = document.getElementById(`keyword-${currentIndex}`);
    
    if (currentKeywordElement) {
      // Set the flag to indicate annotations have been made (even skip is an annotation action)
      hasAnnotatedCurrentImage = true;
      
      // Step 1: Get all current state info and references
      let medData = window.annotatedMedData;
      const commentValue = commentField.value.trim();
      
      // Find the next unannotated keyword (state 1)
      let hasNext = false;
      let nextIdx = -1;
      
      for (let i = 0; i < keywords.length; i++) {
        if (i > currentIndex && keywordStates[i] === 1) {
          hasNext = true;
          nextIdx = i;
          break;
        }
      }
      
      // Step 2: Prepare state change data (but don't apply yet)
      let statesForAPI = [...keywordStates];
      statesForAPI[currentIndex] = 4; // Mark current as skipped
      
      // For API prep: Set next keyword as current if it exists
      if (hasNext) {
        statesForAPI[nextIdx] = 3;
      }
      
      // Create data object for API
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
      
      // Step 3: Send to API
      fetch(`/MedData/ProcessAnnotatedMedData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annotationData),
      })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          // Step 4: After API success, apply state changes to UI
          storeCurrentAnnotation("Uncertain/Skip");
          
          // Apply the same state changes we sent to API
          keywordStates[currentIndex] = 4; // Mark current as skipped
          
          if (hasNext) {
            keywordStates[nextIdx] = 3; // Set next as current
            currentIndex = nextIdx; // Update the current index
          } else {
            nextButton.textContent = "Next Image";
            skipButton.disabled = true;
            notPresentButton.disabled = true;
          }
          
          // Update UI with the new states
          updateKeywordUI();
          
          // Reset for next term
          resetAnnotation();
          loadAnnotationForCurrentTerm();
          commentField.value = "";
          tIdentifyStart = Date.now();
          tAnnotationStart = 0;
        } else {
          console.error("Failed to process annotation data.");
        }
      })
      .catch((error) => console.error("Error:", error));
    }
  });
  notPresentButton.addEventListener("click", function () {
    // Use the current index to identify the current keyword
    const currentKeywordElement = document.getElementById(`keyword-${currentIndex}`);
    
    if (currentKeywordElement) {
      // Set the flag to indicate annotations have been made (even not present is an annotation action)
      hasAnnotatedCurrentImage = true;
      
      // Step 1: Get all current state info and references
      let medData = window.annotatedMedData;
      const commentValue = commentField.value.trim();
      
      // Find the next unannotated keyword (state 1)
      let hasNext = false;
      let nextIdx = -1;
      
      for (let i = 0; i < keywords.length; i++) {
        if (i > currentIndex && keywordStates[i] === 1) {
          hasNext = true;
          nextIdx = i;
          break;
        }
      }
      
      // Step 2: Prepare state change data (but don't apply yet)
      let statesForAPI = [...keywordStates];
      statesForAPI[currentIndex] = 1; // Mark current as not annotated
      
      // For API prep: Set next keyword as current if it exists
      if (hasNext) {
        statesForAPI[nextIdx] = 3;
      }
      
      // Create data object for API
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
      
      // Step 3: Send to API
      fetch(`/MedData/ProcessAnnotatedMedData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annotationData),
      })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          // Step 4: After API success, apply state changes to UI
          storeCurrentAnnotation("Not Visible/Abstract");
          
          // Apply the same state changes we sent to API
          keywordStates[currentIndex] = 1; // Mark current as not annotated
          
          if (hasNext) {
            keywordStates[nextIdx] = 3; // Set next as current
            currentIndex = nextIdx; // Update the current index
          } else {
            nextButton.textContent = "Next Image";
            skipButton.disabled = true;
            notPresentButton.disabled = true;
          }
          
          // Update UI with the new states
          updateKeywordUI();
          
          // Reset for next term
          resetAnnotation();
          loadAnnotationForCurrentTerm();
          commentField.value = "";
          tIdentifyStart = Date.now();
          tAnnotationStart = 0;
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
        boxCoordinates = getAllAnnotationsJSON();
        let t2 = Date.now() - tAnnotationStart;
        let t1 = tAnnotationStart - tIdentifyStart;
        timestamps = `(${t1},${t2})`;
      }
      storedAnnotations[currentIndex] = {
        annotationState: annotations.map((a) => Object.assign({}, a)),
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
  endButton.addEventListener("click", function () {
    // Update keywordStatesJson with the current state before sending
    keywordStatesJson = JSON.stringify(keywordStates);
    
    const requestData = {
      // Use the flag instead of checking annotations.length
      isAnnotationStarted: hasAnnotatedCurrentImage,
      medDataId: window.annotatedMedData ? window.annotatedMedData.id : null,
      keywordStates: keywordStatesJson,
    };
        
    fetch(`/Identity/Logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          window.location.href = "/Identity/Login";
        } else {
          console.error("Failed to process data.");
        }
      })
      .catch((error) => console.error("Error:", error));
  });
  updateNavigationButtons();

  // ====================================================
  // Add the normalizeToTenPoints function near the rdp function
  // ====================================================
  function normalizeToTenPoints(points) {
    // If already has 10 points or fewer, return as is
    if (points.length <= 10) {
      return points;
    }
    
    // Too many points, reduce to exactly 10
    // Strategy: Keep first and last point, and select 8 evenly spaced points in between
    const result = [points[0]];
    const step = (points.length - 1) / 9;
    
    for (let i = 1; i < 9; i++) {
      const index = Math.round(i * step);
      result.push(points[index]);
    }
    
    result.push(points[points.length - 1]);
    return result;
  }

  // Add boundary checking for annotations
  function boundaryCheck(annotation) {
    if (annotation.type === "rectangle") {
      // Ensure rectangle stays within canvas bounds
      const hw = annotation.width / 2;
      const hh = annotation.height / 2;
      
      // Check bounds and adjust center if needed
      // Subtract 2 pixels from boundaries to keep fully inside canvas
      annotation.cx = clamp(annotation.cx, hw + 1, canvas.width - hw - 1);
      annotation.cy = clamp(annotation.cy, hh + 1, canvas.height - hh - 1);
      
      return annotation;
    } else if (annotation.type === "freehand") {
      // For freehand, check each point and constrain it to canvas
      // Keep 2 pixels from the edge to ensure full visibility
      annotation.points = annotation.points.map(point => ({
        x: clamp(point.x, 2, canvas.width - 2), 
        y: clamp(point.y, 2, canvas.height - 2)
      }));
      
      return annotation;
    }
    
    return annotation;
  }

  // Function to update the tools container position
  function updateToolsPosition() {
    // Get positions and dimensions
    const canvasRect = canvas.getBoundingClientRect();
    const imageContainerRect = imageContainer.getBoundingClientRect();
    
    // Position the tools container 5px to the right of the canvas (reduced from 10px)
    toolsContainer.style.position = "fixed";
    toolsContainer.style.left = (imageContainerRect.right + 5) + "px";
    // Position a bit lower (changed from 0.4 to 0.5)
    toolsContainer.style.top = (imageContainerRect.top + imageContainerRect.height * 0.5) + "px";
  }

  // Call the positioning function initially
  updateToolsPosition();

  // Update tools position whenever window is resized
  window.addEventListener('resize', updateToolsPosition);

  // Also update tools position when the image loads
  sourceImage.addEventListener('load', function() {
    // Wait for layout to complete
    setTimeout(updateToolsPosition, 0);
  });

  // Update tools position on scroll as well
  document.addEventListener('scroll', updateToolsPosition);

  // Add a MutationObserver to detect DOM changes that might affect positioning
  const observer = new MutationObserver(updateToolsPosition);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
});
