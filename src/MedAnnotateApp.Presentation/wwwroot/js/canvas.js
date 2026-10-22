// Canvas Manager Class
class CanvasManager {
    constructor(canvasId, sourceImageId, containerId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext("2d");
      this.sourceImage = document.getElementById(sourceImageId);
      this.container = document.getElementById(containerId);
      
      // Annotation state
      this.annotations = [];
      this.selectedAnnotation = null;
      this.currentAction = "none";
      this.currentMode = "rectangle";
      this.offset = { x: 0, y: 0 };
      this.activeHandle = null;
      this.resizingFixedCorner = null;
      this.originalMouseAngle = 0;
      this.originalAnnotationRotation = 0;
      this.rectStart = null;
      this.freehandPoints = [];
      this.currentDrawingAnnotation = null;
      this.isFirstDraw = true;
      this.ready = false;
      this.readOnly = false;
      this.imageIdentity = this.sourceImage.currentSrc || this.sourceImage.src;
      
      // Callback for annotation changes
      this.onAnnotationsChange = null;
  
      // Magnifier state
      this.usingLens = false;
      this.lens = null;
      this._lensSize = 150;
      this._zoomFactor = 4;
      this.draggingLens = false;
      this.isResizingLens = false;
      this.lensOffset = { x: 0, y: 0 };
      this.initialLensSize = 150;
      this.initialMousePos = { x: 0, y: 0 };
      this.resizeMargin = 20;
  
      // Setup event listeners
      this.setupEventListeners();
      this.setupImageLoad();
    }
  
    // RDP Algorithm for freehand simplification
    rdp(points, epsilon) {
      if (points.length < 3) return points;
      
      let dmax = 0;
      let index = 0;
      const start = points[0];
      const end = points[points.length - 1];
      
      for (let i = 1; i < points.length - 1; i++) {
        const d = this.perpendicularDistance(points[i], start, end);
        if (d > dmax) {
          index = i;
          dmax = d;
        }
      }
      
      if (dmax > epsilon) {
        const recResults1 = this.rdp(points.slice(0, index + 1), epsilon);
        const recResults2 = this.rdp(points.slice(index), epsilon);
        return recResults1.slice(0, -1).concat(recResults2);
      } else {
        return [start, end];
      }
    }
  
    perpendicularDistance(p, p1, p2) {
      const num = Math.abs(
        (p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x
      );
      const den = Math.hypot(p2.y - p1.y, p2.x - p1.x);
      return den === 0 ? Math.hypot(p.x - p1.x, p.y - p1.y) : num / den;
    }
  
    adaptiveSimplification(points, minPoints = 8, maxPoints = 25) {
      // If we already have fewer points than minPoints, return as is
      if (points.length <= minPoints) return points;
      
      // If we have more than maxPoints, use RDP with varying epsilon to get a good count
      if (points.length > maxPoints) {
        // Start with a small epsilon and gradually increase until we get a reasonable number of points
        let epsilon = 1.5;  // Start with slightly higher epsilon for better simplification
        let simplified = this.rdp(points, epsilon);
        
        // If we still have too many points, increase epsilon until we get a reasonable count
        // but don't go below our minimum
        while (simplified.length > maxPoints && simplified.length > minPoints) {
          epsilon *= 1.5;  // Increase epsilon by 50% each time
          simplified = this.rdp(points, epsilon);
        }
        
        // If we have too few points, decrease epsilon until we get a reasonable count
        while (simplified.length < minPoints && epsilon > 0.5) {
          epsilon /= 1.5;  // Decrease epsilon
          simplified = this.rdp(points, epsilon);
        }
        
        return simplified;
      }
      
      // If number of points is already within our target range, just return them
      return points;
    }
  
    boundaryCheck(annotation) {
      if (annotation.type === "rectangle") {
        // Rectangle corners use original-image pixels.
        const hw = annotation.width / 2;
        const hh = annotation.height / 2;
        const cos = Math.cos(annotation.rotation);
        const sin = Math.sin(annotation.rotation);
        
        const corners = [
          { x: annotation.cx + (-hw * cos - hh * sin), y: annotation.cy + (-hw * sin + hh * cos) }, // top-left
          { x: annotation.cx + (hw * cos - hh * sin), y: annotation.cy + (hw * sin + hh * cos) },   // top-right
          { x: annotation.cx + (hw * cos + hh * sin), y: annotation.cy + (hw * sin - hh * cos) },   // bottom-right
          { x: annotation.cx + (-hw * cos + hh * sin), y: annotation.cy + (-hw * sin - hh * cos) }  // bottom-left
        ];
        
        // Find the bounding box of the rotated rectangle
        let minX = Math.min(...corners.map(c => c.x));
        let minY = Math.min(...corners.map(c => c.y));
        let maxX = Math.max(...corners.map(c => c.x));
        let maxY = Math.max(...corners.map(c => c.y));
        
        // Calculate boundary margins
        const margin = 0;
        const fit = Math.min(1, this.canvas.width / Math.max(1, maxX - minX), this.canvas.height / Math.max(1, maxY - minY));
        if (fit < 1) {
          annotation.width *= fit;
          annotation.height *= fit;
          return this.boundaryCheck(annotation);
        }
        
        // Calculate how much to move the rectangle to stay within bounds
        let moveX = 0;
        let moveY = 0;
        
        if (minX < margin) {
          moveX = margin - minX;
        } else if (maxX > this.canvas.width - margin) {
          moveX = this.canvas.width - margin - maxX;
        }
        
        if (minY < margin) {
          moveY = margin - minY;
        } else if (maxY > this.canvas.height - margin) {
          moveY = this.canvas.height - margin - maxY;
        }
        
        // Apply the movement to the center point
        annotation.cx += moveX;
        annotation.cy += moveY;
        
        return annotation;
      } else if (annotation.type === "freehand") {
        // Keep freehand points within canvas bounds
        const margin = 0;
        annotation.points = annotation.points.map(point => ({
          x: this.clamp(point.x, margin, this.canvas.width - margin),
          y: this.clamp(point.y, margin, this.canvas.height - margin)
        }));
        
        return annotation;
      }
      return annotation;
    }
  
    // Tool creation and management
    createTools(imageContainer) {
      const toolsContainer = document.createElement("div");
      toolsContainer.className = "tools-container";
      toolsContainer.style.position = "fixed";
      
      const rectButton = this.createToolButton("rectangle", "../images/rectangle-icon.png", "Rectangle Mode", true);
      
      const freehandButton = this.createToolButton("freehand", "../images/pen-icon.png", "Freehand Mode", false);
      
      const magnifyButton = this.createToolButton("magnify", "../images/magnifying-glass.png", "Magnifier Tool", false);
      
      toolsContainer.appendChild(rectButton);
      toolsContainer.appendChild(freehandButton);
      toolsContainer.appendChild(magnifyButton);
      
      document.body.appendChild(toolsContainer);
      this.toolsContainer = toolsContainer;
  
      this.rectButton = rectButton;
      this.freehandButton = freehandButton;
      this.magnifyButton = magnifyButton;
  
      this.updateToolsPosition(imageContainer);
      return { rectButton, freehandButton, magnifyButton };
    }
  
    createToolButton(type, iconSrc, title, isActive) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", title);
      button.className = `tool-button${isActive ? " active" : ""}`;
      button.id = `${type}ModeButton`;
      button.title = title;
      
      const icon = document.createElement("img");
      icon.src = iconSrc;
      icon.alt = title;
      
      button.appendChild(icon);
      return button;
    }
  
    updateToolsPosition(imageContainer) {
      if (!this.toolsContainer) return;
      
      const canvasRect = this.canvas.getBoundingClientRect();
      const imageContainerRect = imageContainer.getBoundingClientRect();
      
      // Position the tools container with a larger margin of 15px
      // and vertically centered with the canvas
      this.toolsContainer.style.position = "fixed";
      this.toolsContainer.style.left = Math.min(canvasRect.right + 5, window.innerWidth - this.toolsContainer.offsetWidth - 6) + "px";
      this.toolsContainer.style.top = Math.max(6, canvasRect.top + (canvasRect.height / 2) - (this.toolsContainer.offsetHeight / 2)) + "px";
    }
  
    // Mode switching
    switchMode(newMode) {
      // Store previous mode for restoration
      const previousMode = this.currentMode;
      
      // Special handling for magnifier mode
      if (newMode === "magnifier") {
        // Toggle magnifier on/off
        if (this.usingLens) {
          this.hideLens();
          // Reset magnifier button style
          if (this.magnifyButton) {
            this.magnifyButton.classList.remove("active");
            this.magnifyButton.style.backgroundColor = "white";
            this.magnifyButton.style.borderColor = "#dee2e6";
          }
        } else {
          this.showLens();
          // Set magnifier button style
          if (this.magnifyButton) {
            this.magnifyButton.classList.add("active");
            this.magnifyButton.style.backgroundColor = "#d9534f"; // Lighter red color
            this.magnifyButton.style.borderColor = "#d9534f";
          }
        }
        return; // Don't change the current drawing mode
      }
      
      // Do nothing if trying to switch to the same drawing mode
      if (this.currentMode === newMode && newMode !== "magnifier") return;

      // Update the current mode for rectangle/freehand
      this.currentMode = newMode;
      
      // Hide lens when switching to annotation modes
      if (this.usingLens) {
        this.hideLens();
        if (this.magnifyButton) {
          this.magnifyButton.classList.remove("active");
          this.magnifyButton.style.backgroundColor = "white";
          this.magnifyButton.style.borderColor = "#dee2e6";
        }
      }
      
      // Update button states for rectangle/freehand
      if (this.rectButton && this.freehandButton) {
        // Reset annotation button states
        this.rectButton.classList.remove("active");
        this.freehandButton.classList.remove("active");
        
        // Reset annotation button styles
        this.rectButton.style.backgroundColor = "white";
        this.rectButton.style.borderColor = "#dee2e6";
        this.freehandButton.style.backgroundColor = "white";
        this.freehandButton.style.borderColor = "#dee2e6";
        
        // Apply active state to the correct annotation button
        if (newMode === "rectangle") {
          this.rectButton.classList.add("active");
          this.rectButton.style.backgroundColor = "#d9534f"; // Lighter red color
          this.rectButton.style.borderColor = "#d9534f";
        } else if (newMode === "freehand") {
          this.freehandButton.classList.add("active");
          this.freehandButton.style.backgroundColor = "#d9534f"; // Lighter red color
          this.freehandButton.style.borderColor = "#d9534f";
        }
      }
    }
  
    // Canvas drawing and manipulation
    drawCanvas() {
      if (!this.ready) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.ctx.drawImage(this.sourceImage, 0, 0, this.canvas.width, this.canvas.height);
      
      this.annotations.forEach(ann => this.drawAnnotation(ann, ann === this.selectedAnnotation));
      if (this.currentAction === "draw" && this.currentDrawingAnnotation) {
        this.drawAnnotation(this.currentDrawingAnnotation, true);
      }
    }
  
    drawAnnotation(ann, isSelected) {
      if (ann.type === "rectangle") {
        this.drawRectangle(ann, isSelected);
      } else if (ann.type === "freehand") {
        this.drawFreehand(ann, isSelected);
      }
      
      if (isSelected) {
        this.drawHandles(ann);
      }
    }
  
    drawRectangle(ann, isSelected) {
      this.ctx.save();
      this.ctx.translate(ann.cx, ann.cy);
      this.ctx.rotate(ann.rotation);
      this.ctx.lineWidth = this.screenPixels(2);
      this.ctx.strokeStyle = isSelected ? "red" : "blue";
      this.ctx.strokeRect(-ann.width / 2, -ann.height / 2, ann.width, ann.height);
      
      // Add fill with transparency and border
      this.ctx.fillStyle = isSelected ? "rgba(255,0,0,0.1)" : "rgba(0,0,255,0.1)";
      this.ctx.fillRect(-ann.width / 2, -ann.height / 2, ann.width, ann.height);
      
      // Add second border for better visibility
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = this.screenPixels(1);
      this.ctx.strokeRect(-ann.width / 2, -ann.height / 2, ann.width, ann.height);
      
      this.ctx.restore();
    }
  
    drawFreehand(ann, isSelected) {
      this.ctx.beginPath();
      ann.points.forEach((pt, index) => {
        if (index === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      });
      
      // Close the path if it's not closed
      if (ann.points.length > 2) {
        const first = ann.points[0];
        const last = ann.points[ann.points.length - 1];
        if (Math.hypot(last.x - first.x, last.y - first.y) > 5) {
          this.ctx.lineTo(first.x, first.y);
        }
      }
      
      // Add white border first
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = this.screenPixels(4);
      this.ctx.stroke();
      
      // Then add colored border
      this.ctx.strokeStyle = isSelected ? "red" : "blue";
      this.ctx.lineWidth = this.screenPixels(2);
      this.ctx.stroke();
      
      // Add fill with transparency
      this.ctx.fillStyle = isSelected ? "rgba(255,0,0,0.1)" : "rgba(0,0,255,0.1)";
      this.ctx.fill();
    }
  
    drawHandles(ann) {
      if (ann.type === "rectangle") {
        const handles = this.getAnnotationHandles(ann);
        this.drawRectangleHandles(handles);
      } else if (ann.type === "freehand") {
        this.drawFreehandHandles(ann);
      }
    }
  
    drawRectangleHandles(handles) {
      const size = this.screenPixels(8);
      this.ctx.fillStyle = "white";
      this.ctx.lineWidth = this.screenPixels(1);
      this.ctx.strokeStyle = "black";
      
      // Draw resize handles
      ['tl', 'tr', 'bl', 'br'].forEach(key => {
        let h = handles[key];
        this.ctx.fillRect(h.x - size/2, h.y - size/2, size, size);
        this.ctx.strokeRect(h.x - size/2, h.y - size/2, size, size);
      });
      
      // Draw rotation handle
      const rHandle = handles.rotate;
      this.ctx.beginPath();
      this.ctx.arc(rHandle.x, rHandle.y, this.screenPixels(5), 0, 2 * Math.PI);
      this.ctx.fillStyle = "red";
      this.ctx.fill();
      this.ctx.lineWidth = this.screenPixels(1);
      this.ctx.strokeStyle = "black";
      this.ctx.stroke();
      
      // Draw delete handle with X
      const dHandle = handles.delete;
      this.ctx.fillStyle = "white";
      const half = this.screenPixels(6), full = half * 2;
      this.ctx.fillRect(dHandle.x - half, dHandle.y - half, full, full);
      this.ctx.lineWidth = this.screenPixels(1);
      this.ctx.strokeStyle = "black";
      this.ctx.strokeRect(dHandle.x - half, dHandle.y - half, full, full);
      this.ctx.fillStyle = "black";
      this.ctx.font = `${this.screenPixels(10)}px sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("X", dHandle.x, dHandle.y);
    }
  
    drawFreehandHandles(ann) {
      const handle = this.getFreehandDeleteHandle(ann);
      const size = this.screenPixels(12);
      const handleX = handle.x, handleY = handle.y;
      
      // Draw delete handle with X
      this.ctx.fillStyle = "white";
      this.ctx.fillRect(handleX, handleY, size, size);
      this.ctx.lineWidth = this.screenPixels(1);
      this.ctx.strokeStyle = "black";
      this.ctx.strokeRect(handleX, handleY, size, size);
      this.ctx.fillStyle = "black";
      this.ctx.font = `${this.screenPixels(10)}px sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("X", handleX + size/2, handleY + size/2);
    }
  
    // Magnifier functions
    showLens() {
      if (this.lens) {
        document.body.removeChild(this.lens);
        this.lens = null;
      }
      
      // Clear displayed annotations regardless of page type
      this.clearDisplayedAnnotations();
      
      this.lens = document.createElement("div");
      this.lens.className = "lens";
      
      // Make lens circular with red border - using lighter red color
      this.lens.style.border = "2px solid #d9534f";
      this.lens.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
      this.lens.style.borderRadius = "50%";
      this.lens.style.overflow = "hidden";
      this.lens.style.position = "fixed";
      this.lens.style.width = "180px";
      this.lens.style.height = "180px";
      this.lens.style.pointerEvents = "auto";
      this.lens.style.zIndex = "1000";
      
      const lensCanvas = document.createElement("canvas");
      lensCanvas.width = this._lensSize;
      lensCanvas.height = this._lensSize;
      this.lens.appendChild(lensCanvas);
      this.lens.ctx = lensCanvas.getContext("2d");
      
      const canvasRect = this.canvas.getBoundingClientRect();
      const lensLeft = canvasRect.left + (canvasRect.width / 2) - (this._lensSize / 2);
      const lensTop = canvasRect.top + (canvasRect.height / 2) - (this._lensSize / 2);
      
      this.lens.style.width = this._lensSize + "px";
      this.lens.style.height = this._lensSize + "px";
      this.lens.style.left = lensLeft + "px";
      this.lens.style.top = lensTop + "px";
      
      document.body.appendChild(this.lens);
      this.setupLensEventListeners();
      this.usingLens = true;
      this.updateLens();
      
      // Initially start showing the lens at the center of the canvas
      const centerX = canvasRect.left + canvasRect.width/2;
      const centerY = canvasRect.top + canvasRect.height/2;
      
      this.moveLensTo(centerX, centerY);
      
      // IMPORTANT: We specifically don't add any mouse follow behavior
      // The lens should only move when explicitly dragged
    }
  
    hideLens() {
      // Remove the lens element from the DOM
      if (this.lens) {
        // Remove any move and up handlers that might be attached to document
        if (this.lens.moveHandler) {
        document.removeEventListener("mousemove", this.lens.moveHandler);
        }
        
        if (this.lens.upHandler) {
        document.removeEventListener("mouseup", this.lens.upHandler);
        }
        
        document.body.removeChild(this.lens);
        this.lens = null;
      }
  
      // Reset flags
      this.usingLens = false;
      this.draggingLens = false;
      this.isResizingLens = false;
      
      // Redraw the canvas with annotations
      this.drawCanvas();
    }
  
    updateLens() {
      if (!this.lens) return;
      
      const lensRect = this.lens.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();
      
      const relativeLensX = (lensRect.left + lensRect.width/2) - canvasRect.left;
      const relativeLensY = (lensRect.top + lensRect.height/2) - canvasRect.top;
      
      const buffer = this._lensSize;
      if (relativeLensX < -buffer || relativeLensX > canvasRect.width + buffer ||
          relativeLensY < -buffer || relativeLensY > canvasRect.height + buffer) {
        return;
      }
      
      const scale = 1 / this._zoomFactor;
      const sourceWidth = this.screenPixels(this._lensSize * scale);
      const sourceHeight = this.screenPixels(this._lensSize * scale);
      
      let sourceX = relativeLensX * this.canvas.width / canvasRect.width - sourceWidth/2;
      let sourceY = relativeLensY * this.canvas.height / canvasRect.height - sourceHeight/2;
      
      sourceX = Math.max(0, Math.min(sourceX, this.canvas.width - sourceWidth));
      sourceY = Math.max(0, Math.min(sourceY, this.canvas.height - sourceHeight));
      
      const lensCanvas = this.lens.querySelector("canvas");
      const lensCtx = lensCanvas.getContext("2d");
      
      lensCtx.clearRect(0, 0, this._lensSize, this._lensSize);
      
      try {
        lensCtx.drawImage(
          this.canvas,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          this._lensSize,
          this._lensSize
        );
        
        const center = this._lensSize / 2;
        lensCtx.strokeStyle = "rgba(255,0,0,0.7)";
        lensCtx.lineWidth = 1;
        
        lensCtx.beginPath();
        lensCtx.moveTo(center - 10, center);
        lensCtx.lineTo(center + 10, center);
        lensCtx.stroke();
        
        lensCtx.beginPath();
        lensCtx.moveTo(center, center - 10);
        lensCtx.lineTo(center, center + 10);
        lensCtx.stroke();
      } catch (e) {
        console.error("Error updating lens:", e);
      }
    }
  
    // Modified to prevent automatic cursor following
    handleLensFollowMouse(e) {
      // We're intentionally leaving this empty to prevent 
      // the lens from automatically following the cursor
      return;
    }
  
    moveLensTo(x, y) {
      if (!this.lens) return;
      
      const lensRect = this.lens.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();
      
      // Calculate new position keeping lens within canvas bounds
      const newX = Math.max(
        canvasRect.left,
        Math.min(x - lensRect.width/2, canvasRect.right - lensRect.width)
      );
      
      const newY = Math.max(
        canvasRect.top,
        Math.min(y - lensRect.height/2, canvasRect.bottom - lensRect.height)
      );
      
      this.lens.style.left = newX + "px";
      this.lens.style.top = newY + "px";
      
      this.updateLens();
    }
  
    // Helper functions
    getAnnotationHandles(ann) {
      const hw = ann.width / 2, hh = ann.height / 2;
      const localHandles = {
        tl: { x: -hw, y: -hh },
        tr: { x: hw, y: -hh },
        bl: { x: -hw, y: hh },
        br: { x: hw, y: hh },
        rotate: { x: 0, y: -hh - this.screenPixels(30) },
        delete: { x: hw + this.screenPixels(10), y: -hh - this.screenPixels(10) },
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
        if (key === "delete" || key === "rotate") {
          const margin = this.screenPixels(7);
          handles[key].x = this.clamp(handles[key].x, margin, this.canvas.width - margin);
          handles[key].y = this.clamp(handles[key].y, margin, this.canvas.height - margin);
        }
      }
      return handles;
    }
  
    getBoundingBox(points) {
      let minX = Infinity, minY = Infinity,
          maxX = -Infinity, maxY = -Infinity;
      
      points.forEach(pt => {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      });
      
      return { minX, minY, maxX, maxY };
    }
  
    isPointInAnnotation(ann, x, y) {
      if (ann.type === "rectangle") {
        const dx = x - ann.cx, dy = y - ann.cy;
        const cos = Math.cos(-ann.rotation),
              sin = Math.sin(-ann.rotation);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        return Math.abs(localX) <= ann.width / 2 && Math.abs(localY) <= ann.height / 2;
      } else if (ann.type === "freehand") {
        for (let i = 0; i < ann.points.length - 1; i++) {
          if (this.distanceToSegment({ x, y }, ann.points[i], ann.points[i + 1]) < this.screenPixels(5)) {
            return true;
          }
        }
        return false;
      }
    }
  
    distanceToSegment(p, v, w) {
      const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
      if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
      let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const proj = {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
      };
      return Math.hypot(p.x - proj.x, p.y - proj.y);
    }
  
    isPointNearHandle(point, handle, radius = 8) {
      const dx = point.x - handle.x,
            dy = point.y - handle.y;
      return Math.hypot(dx, dy) < this.screenPixels(radius);
    }
  
    // State management
    resetDrawingState() {
      this.currentDrawingAnnotation = null;
      this.rectStart = null;
      this.freehandPoints = [];
      this.currentAction = "none";
    }
  
    resetAnnotation() {
      this.annotations = [];
      this.selectedAnnotation = null;
      this.currentAction = "none";
      this.rectStart = null;
      this.freehandPoints = [];
      this.currentDrawingAnnotation = null;
      this.drawCanvas();
      this.isFirstDraw = true;
    }
  
    // Event handlers setup
    setupEventListeners() {
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute("aria-label", "Medical image annotation canvas. Draw with the pointer. Delete removes the selected shape.");
      this.canvas.addEventListener("keydown", e => {
        if (this.readOnly || !this.selectedAnnotation || !["Delete", "Backspace"].includes(e.key)) return;
        e.preventDefault();
        this.annotations = this.annotations.filter(annotation => annotation !== this.selectedAnnotation);
        this.selectedAnnotation = null;
        this.resetDrawingState(); this.drawCanvas();
        if (this.onAnnotationsChange) this.onAnnotationsChange();
      });
      this.canvas.addEventListener("pointerdown", e => {
        if (e.button !== 0 || !this.ready || this.readOnly) return;
        e.preventDefault();
        this.canvas.focus({preventScroll:true});
        this.canvas.setPointerCapture(e.pointerId);
        this.handleMouseDown(e);
      });
      this.canvas.addEventListener("pointermove", e => this.handleMouseMove(e));
      this.canvas.addEventListener("pointerup", e => {
        this.handleMouseUp(e);
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      });
      this.canvas.addEventListener("pointercancel", () => {
        // Interrupted gestures must never become saveable partial shapes.
        if (this.originalAnnotation && this.selectedAnnotation) Object.assign(this.selectedAnnotation, this.originalAnnotation);
        this.resetDrawingState(); this.drawCanvas();
      });
    }
  
    setupImageLoad() {
      const loaded = () => {
        if (!this.sourceImage.naturalWidth || !this.sourceImage.naturalHeight) return;
        const identity = this.sourceImage.currentSrc || this.sourceImage.src;
        if (identity !== this.imageIdentity) {
          this.ready = false;
          this.reportImageError("The source image changed. Reload this assignment before annotating.");
          return;
        }
        // The backing store always has the original dimensions. Device pixel ratio
        // therefore does not change geometry, and CSS resizing cannot change it.
        this.canvas.width = this.sourceImage.naturalWidth;
        this.canvas.height = this.sourceImage.naturalHeight;
        this.ready = true;
        this.resizeDisplay();
        this.canvas.dispatchEvent(new CustomEvent("annotationimageready"));
      };
      this.sourceImage.addEventListener("load", loaded);
      this.sourceImage.addEventListener("error", () => {
        this.ready = false;
        this.reportImageError("This image could not be loaded. Annotations cannot be saved. Reload the page or report the image ID.");
      });
      if (this.sourceImage.complete) {
        if (this.sourceImage.naturalWidth) loaded();
        else this.reportImageError("This image could not be loaded. Reload the page or report the image ID.");
      }
      window.addEventListener("resize", () => this.resizeDisplay());
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => this.resizeDisplay());
        this.resizeObserver.observe(this.container.closest(".image-viewport") || this.container.closest(".left-column") || this.container.parentElement);
      }
      document.addEventListener("scroll", () => {
        this.updateToolsPosition(document.getElementById("image-container"));
        if (this.usingLens) this.updateLens();
      }, true);
    }

    resizeDisplay() {
      if (!this.ready) return;
      const imageContainer = this.container.parentElement;
      const column = imageContainer.closest(".left-column");
      const viewport = imageContainer.closest(".image-viewport");
      const availableWidth = Math.max(1, (viewport ? viewport.clientWidth : column ? column.clientWidth : window.innerWidth - 80) - 8);
      const availableHeight = viewport ? Math.max(1, viewport.clientHeight - 8) : 520;
      const scale = Math.min(1, availableWidth / this.canvas.width, availableHeight / this.canvas.height);
      const width = this.canvas.width * scale, height = this.canvas.height * scale;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.container.style.width = `${width}px`;
      this.container.style.height = `${height}px`;
      imageContainer.style.width = `${width}px`;
      imageContainer.style.height = `${height}px`;
      this.drawCanvas();
      this.updateToolsPosition(imageContainer);
    }

    reportImageError(message) {
      const status = document.getElementById("annotation-status");
      if (status) { status.textContent = message; status.dataset.state = "error"; }
      this.canvas.dispatchEvent(new CustomEvent("annotationimageerror"));
    }

    screenPixels(value) {
      const width = this.canvas.getBoundingClientRect().width;
      return width > 0 ? value * this.canvas.width / width : value;
    }

    eventPoint(e) {
      return AnnotationGeometry.clientToImage(e.clientX, e.clientY, this.canvas.getBoundingClientRect(), this.canvas.width, this.canvas.height);
    }

    getFreehandDeleteHandle(annotation) {
      const bounds = this.getBoundingBox(annotation.points), gap = this.screenPixels(5), size = this.screenPixels(12);
      return { x: this.clamp(bounds.maxX + gap, 0, this.canvas.width - size), y: this.clamp(bounds.minY - gap, 0, this.canvas.height - size) };
    }
  
    // Mouse event handlers
    handleMouseDown(e) {
      // Don't allow drawing when magnifier is active
      if (this.usingLens || !this.ready || this.readOnly) return;
      const { x: mouseX, y: mouseY } = this.eventPoint(e);
      
      // Check for freehand delete button first
      if (this.selectedAnnotation && this.selectedAnnotation.type === "freehand") {
        const handle = this.getFreehandDeleteHandle(this.selectedAnnotation);
        const handleX = handle.x, handleY = handle.y, size = this.screenPixels(12);
        
        if (mouseX >= handleX && mouseX <= handleX + size &&
            mouseY >= handleY && mouseY <= handleY + size) {
          this.annotations = this.annotations.filter(a => a !== this.selectedAnnotation);
          this.selectedAnnotation = null;
          this.drawCanvas();
          
          // Notify about annotation change
          if (this.onAnnotationsChange) {
            this.onAnnotationsChange();
          }
          return;
        }
      }
      
      // Check if we clicked on the selected annotation's handle
      if (this.selectedAnnotation && this.selectedAnnotation.type === "rectangle") {
        const handles = this.getAnnotationHandles(this.selectedAnnotation);
        
        // Check rotation handle
        if (this.isPointNearHandle({ x: mouseX, y: mouseY }, handles.rotate)) {
          this.currentAction = "rotate";
          this.originalAnnotation = structuredClone(this.selectedAnnotation);
          this.originalMouseAngle = Math.atan2(mouseY - this.selectedAnnotation.cy, mouseX - this.selectedAnnotation.cx);
          this.originalAnnotationRotation = this.selectedAnnotation.rotation;
          return;
        }
        
        // Check delete handle
        if (this.isPointNearHandle({ x: mouseX, y: mouseY }, handles.delete)) {
          this.annotations = this.annotations.filter(a => a !== this.selectedAnnotation);
          this.selectedAnnotation = null;
          this.drawCanvas();
          
          // Notify about annotation change
          if (this.onAnnotationsChange) {
            this.onAnnotationsChange();
          }
          return;
        }
        
        // Check resize handles
        for (const corner of ['tl', 'tr', 'bl', 'br']) {
          if (this.isPointNearHandle({ x: mouseX, y: mouseY }, handles[corner])) {
            this.currentAction = "resize";
            this.activeHandle = corner;
            this.resizingFixedCorner = { 
              tl: 'br', tr: 'bl', bl: 'tr', br: 'tl'
            }[corner];
            
            // Store the original annotation with all properties
            this.originalAnnotation = JSON.parse(JSON.stringify(this.selectedAnnotation));
            
            // Store fixed corner location in rotated space
            const fixedCornerPos = handles[this.resizingFixedCorner];
            this.fixedCornerX = fixedCornerPos.x;
            this.fixedCornerY = fixedCornerPos.y;
            
            return;
          }
        }
      }
      
      // Check if we clicked on an existing annotation
      for (let i = this.annotations.length - 1; i >= 0; i--) {
        const ann = this.annotations[i];
        if (this.isPointInAnnotation(ann, mouseX, mouseY)) {
          this.selectedAnnotation = ann;
          this.currentAction = "move";
          this.offset = { x: mouseX, y: mouseY };
          this.originalAnnotation = structuredClone(ann);
          this.drawCanvas();
          return;
        }
      }
      
      // If we didn't click on anything, start drawing a new annotation
      this.selectedAnnotation = null;
      
      if (this.currentMode === "rectangle") {
        this.currentAction = "draw";
        this.rectStart = { x: mouseX, y: mouseY };
        this.currentDrawingAnnotation = {
          type: "rectangle",
          cx: mouseX,
          cy: mouseY,
          width: 0,
          height: 0,
          rotation: 0
        };
      } else if (this.currentMode === "freehand") {
        this.currentAction = "draw";
        this.freehandPoints = [{ x: mouseX, y: mouseY }];
        this.currentDrawingAnnotation = {
          type: "freehand",
          points: [...this.freehandPoints]
        };
      }
      
      this.drawCanvas();
    }
  
    handleMouseMove(e) {
      if (this.usingLens || !this.ready || this.readOnly) return;
      const { x: mouseX, y: mouseY } = this.eventPoint(e);
      
      switch (this.currentAction) {
        case "move":
          if (this.selectedAnnotation) {
            const dx = mouseX - this.offset.x, dy = mouseY - this.offset.y;
            if (this.selectedAnnotation.type === "rectangle") {
              this.selectedAnnotation.cx = this.originalAnnotation.cx + dx;
              this.selectedAnnotation.cy = this.originalAnnotation.cy + dy;
            } else {
              const bounds = this.getBoundingBox(this.originalAnnotation.points);
              const boundedX = this.clamp(dx, -bounds.minX, this.canvas.width - bounds.maxX);
              const boundedY = this.clamp(dy, -bounds.minY, this.canvas.height - bounds.maxY);
              this.selectedAnnotation.points = this.originalAnnotation.points.map(p => ({x:p.x+boundedX,y:p.y+boundedY}));
            }
            this.selectedAnnotation = this.boundaryCheck(this.selectedAnnotation);
            this.drawCanvas();
          }
          break;
          
        case "resize":
          if (this.selectedAnnotation && this.selectedAnnotation.type === "rectangle" && this.originalAnnotation) {
            // Get original rotation from stored annotation
            const rotation = this.originalAnnotation.rotation;
            
            // Get the fixed corner position from when we started the resize
            const fixedCornerX = this.fixedCornerX;
            const fixedCornerY = this.fixedCornerY;

            // Transform mouse coordinates to rectangle's rotated coordinate system
            const translatedMouseX = mouseX - fixedCornerX;
            const translatedMouseY = mouseY - fixedCornerY;
            
            // Rotate to align with rectangle's orientation
            const cos = Math.cos(-rotation);
            const sin = Math.sin(-rotation);
            const rotatedMouseX = translatedMouseX * cos - translatedMouseY * sin;
            const rotatedMouseY = translatedMouseX * sin + translatedMouseY * cos;
            
            // Calculate dimensions in rotated space - allow very small sizes (5px minimum)
            const width = Math.max(1, Math.abs(rotatedMouseX));
            const height = Math.max(1, Math.abs(rotatedMouseY));
            
            // Calculate center point
            // First determine the direction of resize based on which corner is being dragged
            const dirX = rotatedMouseX >= 0 ? 1 : -1;
            const dirY = rotatedMouseY >= 0 ? 1 : -1;
            
            // Calculate new center point in rotated space
            const rotatedCenterX = (width / 2) * dirX;
            const rotatedCenterY = (height / 2) * dirY;
            
            // Transform the center back to image coordinates.
            const screenCos = Math.cos(rotation);
            const screenSin = Math.sin(rotation);
            const centerOffsetX = rotatedCenterX * screenCos - rotatedCenterY * screenSin;
            const centerOffsetY = rotatedCenterX * screenSin + rotatedCenterY * screenCos;
            
            // Final center position
            const centerX = fixedCornerX + centerOffsetX;
            const centerY = fixedCornerY + centerOffsetY;
            
            // Update the rectangle
            this.selectedAnnotation.width = width;
            this.selectedAnnotation.height = height;
            this.selectedAnnotation.cx = centerX;
            this.selectedAnnotation.cy = centerY;
            this.selectedAnnotation.rotation = rotation; // Preserve the original rotation
            
            // Apply boundary check
            this.selectedAnnotation = this.boundaryCheck(this.selectedAnnotation);
            this.drawCanvas();
          }
          break;
          
        case "rotate":
          if (this.selectedAnnotation && this.selectedAnnotation.type === "rectangle") {
            const newAngle = Math.atan2(mouseY - this.selectedAnnotation.cy, mouseX - this.selectedAnnotation.cx);
            const angleDiff = newAngle - this.originalMouseAngle;
            this.selectedAnnotation.rotation = this.originalAnnotationRotation + angleDiff;
            
            // Apply boundary check after rotation
            this.selectedAnnotation = this.boundaryCheck(this.selectedAnnotation);
            
            this.drawCanvas();
          }
          break;
          
        case "draw":
          if (this.currentMode === "rectangle" && this.rectStart) {
            const width = Math.abs(mouseX - this.rectStart.x);
            const height = Math.abs(mouseY - this.rectStart.y);
            const cx = (mouseX + this.rectStart.x) / 2;
            const cy = (mouseY + this.rectStart.y) / 2;
            
            this.currentDrawingAnnotation = {
              type: "rectangle",
              cx,
              cy,
              width,
              height,
              rotation: 0
            };
            
            this.currentDrawingAnnotation = this.boundaryCheck(this.currentDrawingAnnotation);
            this.drawCanvas();
          } else if (this.currentMode === "freehand") {
            // Store points but don't show them while drawing
            const last = this.freehandPoints[this.freehandPoints.length - 1];
            if (!last || Math.hypot(mouseX-last.x, mouseY-last.y) >= 0.25) this.freehandPoints.push({ x: mouseX, y: mouseY });
            
            // Draw current path without points
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(this.sourceImage, 0, 0, this.canvas.width, this.canvas.height);
            
            // Draw existing annotations
            this.annotations.forEach(ann => this.drawAnnotation(ann, ann === this.selectedAnnotation));
            
            // Draw current freehand path
            this.ctx.beginPath();
            this.freehandPoints.forEach((pt, index) => {
              if (index === 0) this.ctx.moveTo(pt.x, pt.y);
              else this.ctx.lineTo(pt.x, pt.y);
            });
            
            // Draw white border first
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = this.screenPixels(4);
            this.ctx.stroke();
            
            // Then draw blue border
            this.ctx.strokeStyle = "blue";
            this.ctx.lineWidth = this.screenPixels(2);
            this.ctx.stroke();
          }
          break;
      }
    }
  
    handleMouseUp(e) {
      if (this.usingLens || !this.ready || this.readOnly) return;
      const changed = this.currentAction !== "none";
      
      // Handle end of resizing to ensure rotation is properly maintained
      if (this.currentAction === "resize") {
        this.handleResizeEnd();
      }
      
      if (this.currentAction === "draw") {
        if (this.currentMode === "rectangle") {
          const { x: mouseX, y: mouseY } = this.eventPoint(e);
          
          const width = Math.abs(mouseX - this.rectStart.x);
          const height = Math.abs(mouseY - this.rectStart.y);
          
          if (width >= 1 && height >= 1) {
            const cx = (mouseX + this.rectStart.x) / 2;
            const cy = (mouseY + this.rectStart.y) / 2;
            
            const newAnnotation = {
              type: "rectangle",
              cx,
              cy,
              width,
              height,
              rotation: 0
            };
            
            const checkedAnnotation = this.boundaryCheck(newAnnotation);
            this.annotations.push(checkedAnnotation);
            this.selectedAnnotation = checkedAnnotation;
            
            if (this.isFirstDraw) {
              this.isFirstDraw = false;
              if (typeof window.setAnnotationStartTime === 'function') {
                window.setAnnotationStartTime();
              }
            }
            
            if (this.onAnnotationsChange) {
              this.onAnnotationsChange();
            }
          }
        } else if (this.currentMode === "freehand" && this.freehandPoints.length > 2) {
          // Keep sampled image-space vertices. The previous adaptive reduction to
          // 25 points could move a research boundary by an unbounded distance.
          const simplified = this.freehandPoints.map(p => ({...p}));
          const first = simplified[0];
          simplified.push({ ...first });
          if (AnnotationGeometry.area(simplified.map(p => [p.x,p.y])) < 1 || simplified.length > 20000) {
            const status = document.getElementById("annotation-status");
            if (status) {
              status.textContent = simplified.length > 20000 ? "This outline has too many points. Draw a shorter outline before saving." : "The outline must enclose an area. Draw a closed boundary before saving.";
              status.dataset.state = "error";
            }
            this.resetDrawingState(); this.drawCanvas(); return;
          }
          
          const newAnnotation = {
            type: "freehand",
            points: simplified
          };
          
          const checkedAnnotation = this.boundaryCheck(newAnnotation);
          this.annotations.push(checkedAnnotation);
          this.selectedAnnotation = checkedAnnotation;
          
          if (this.isFirstDraw) {
            this.isFirstDraw = false;
            if (typeof window.setAnnotationStartTime === 'function') {
              window.setAnnotationStartTime();
            }
          }
          
          if (this.onAnnotationsChange) {
            this.onAnnotationsChange();
          }
        }
      }
      
      this.resetDrawingState();
      this.drawCanvas();
      if (changed && this.onAnnotationsChange) this.onAnnotationsChange();
    }
  
    // Utility functions
    clamp(val, min, max) {
      return Math.min(Math.max(val, min), max);
    }
  
    // Public methods for external use
    getAnnotations() {
      return this.annotations;
    }
  
    setAnnotations(newAnnotations) {
      this.annotations = structuredClone(newAnnotations);
      this.selectedAnnotation = null;
      this.resetDrawingState();
      this.drawCanvas();
    }

    loadCoordinates(json) {
      if (!this.ready) throw new Error("Wait for the image to load.");
      this.setAnnotations(AnnotationGeometry.deserialize(json, this.canvas.width, this.canvas.height));
    }
  
    // Get coordinates for a single annotation
    getAnnotationCoordinatesJSON(annotation) {
      return AnnotationGeometry.corners(annotation).map(p => p.map(n => Math.round(n*1000)/1000));
    }
  
    // Get all annotations as JSON
    getAllAnnotationsJSON() {
      if (!this.ready || this.currentAction !== "none" || this.imageIdentity !== (this.sourceImage.currentSrc || this.sourceImage.src)) throw new Error("Finish drawing and wait for the assigned image before saving.");
      return AnnotationGeometry.serialize(this.annotations, this.canvas.width, this.canvas.height);
    }
  
    getAnnotationCornersOriginal(ann) {
      return this.getAnnotationCoordinatesJSON(ann);
    }
  
    setupLensEventListeners() {
      if (!this.lens) return;
      
      const updateLensCursor = (e) => {
        if (!this.lens) return;
        const lensRect = this.lens.getBoundingClientRect();
        const x = e.clientX - lensRect.left;
        const y = e.clientY - lensRect.top;
        const margin = 10; // Smaller margin for better edge detection
        
        if (x < margin || x > lensRect.width - margin ||
            y < margin || y > lensRect.height - margin) {
          this.lens.style.cursor = "nwse-resize";
        } else {
          this.lens.style.cursor = "move";
        }
      };
      
      this.lens.moveHandler = (e) => {
        if (this.draggingLens) {
          const canvasRect = this.canvas.getBoundingClientRect();
          let newLeft = e.clientX - this.lensOffset.x;
          let newTop = e.clientY - this.lensOffset.y;
          
          // Keep lens within canvas bounds with a small margin
          const margin = 5;
          newLeft = Math.max(canvasRect.left - margin, Math.min(newLeft, canvasRect.right - this._lensSize + margin));
          newTop = Math.max(canvasRect.top - margin, Math.min(newTop, canvasRect.bottom - this._lensSize + margin));
          
          this.lens.style.left = newLeft + "px";
          this.lens.style.top = newTop + "px";
          
          this.updateLens();
        } else if (this.isResizingLens) {
          const dx = e.clientX - this.initialMousePos.x;
          const dy = e.clientY - this.initialMousePos.y;
          const delta = Math.max(Math.abs(dx), Math.abs(dy)) * (dx > 0 ? 1 : -1);
          let newSize = this.initialLensSize + delta;
          
          // Limit size (75px to 200px)
          newSize = Math.max(75, Math.min(newSize, 200));
          this._lensSize = newSize;
          
          // Update lens size
          this.lens.style.width = this._lensSize + "px";
          this.lens.style.height = this._lensSize + "px";
          
          // Update canvas size
          const lensCanvas = this.lens.querySelector("canvas");
          lensCanvas.width = this._lensSize;
          lensCanvas.height = this._lensSize;
          
          this.updateLens();
        }
      };
      
      this.lens.addEventListener("mousemove", updateLensCursor);
      
      this.lens.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const lensRect = this.lens.getBoundingClientRect();
        const x = e.clientX - lensRect.left;
        const y = e.clientY - lensRect.top;
        const margin = 10;
        
        if (x < margin || x > lensRect.width - margin ||
            y < margin || y > lensRect.height - margin) {
          this.isResizingLens = true;
          this.initialLensSize = this._lensSize;
          this.initialMousePos = { x: e.clientX, y: e.clientY };
        } else {
          this.draggingLens = true;
          this.lensOffset = { 
            x: e.clientX - lensRect.left, 
            y: e.clientY - lensRect.top 
          };
        }
      });
      
      this.lens.upHandler = () => {
        this.draggingLens = false;
        this.isResizingLens = false;
      };
      
      document.addEventListener("mousemove", this.lens.moveHandler);
      document.addEventListener("mouseup", this.lens.upHandler);
    }
  
    // Add a helper method for handling resize end
    handleResizeEnd() {
      if (this.currentAction === "resize" && this.selectedAnnotation && this.originalAnnotation) {
        // Apply any final adjustments to the resized annotation
        // This ensures rotation is properly maintained
        this.selectedAnnotation.rotation = this.originalAnnotation.rotation;
        
        // Clear original annotation reference
        this.originalAnnotation = null;
      }
    }
  
    // Add this method to temporarily clear displayed annotations (for magnifier mode)
    clearDisplayedAnnotations() {
      // Temporarily hide annotations when using magnifier in professional mode
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.sourceImage, 0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  // Export the CanvasManager class
  window.CanvasManager = CanvasManager;
