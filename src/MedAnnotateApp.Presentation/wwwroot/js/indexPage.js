document.addEventListener('DOMContentLoaded', function () {
    const nextButton = document.getElementById('next-button');
    const skipButton = document.getElementById('skip-button');
    const notPresentButton = document.getElementById('not-present-button');
    const endButton = document.getElementById('end-button');
    
    endButton.addEventListener('click', function () {
        fetch(`/Identity/Logout?medDataId=${window.annotatedMedData.id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                localStorage.removeItem('keywordStates');
                window.location.href = '/Identity/Login';
            } else {
                console.error("Failed to process data.");
            }
        })
        .catch(error => console.error('Error:', error));
    });

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const image = document.getElementById('image');
    const container = document.getElementById('image-container');
    const keywords = document.querySelectorAll('.keyword');
    
    let isDrawingDisabled = false;
    
    // 1 - not annotated; 2 - annotated; 3 - current; 4 - skipped
    let keywordStatesJson = localStorage.getItem("keywordStates");
    let keywordStates = JSON.parse(keywordStatesJson) || Array.from({ length: keywords.length }, (_, i) => (i === 0 ? 3 : 1));
    
    let startToDrawStart = Date.now();
    let startToDrawEnd;
    let drawToNextStart;
    let isFirstDraw = true; // Flag to ensure first draw on current keyword
    
    function removeAllKeywordClasses(element) { 
        element.classList.forEach(className => {
            if (className.includes('_')) {
                element.classList.remove(className);
            }
        });
    }
    
    if (keywordStatesJson) {    
        for (let i = 0; i < keywords.length; i++) {
            let curr = keywords[i];
            removeAllKeywordClasses(curr);
            if (keywordStates[i] == 1) {
                curr.classList.add('not_annotated_keyword');
            } else if (keywordStates[i] == 2) {
                curr.classList.add('annotated_keyword');
            } else if (keywordStates[i] == 3) {
                curr.classList.add('current_keyword');
            } else if (keywordStates[i] == 4) {
                curr.classList.add('skipped_keyword');
            }
        }
        if (keywordStates[keywords.length-1] === 2 ||  keywordStates[keywords.length-1] === 4) {
            nextButton.textContent = "Next Image";
            nextButton.removeAttribute('disabled');
            endButton.removeAttribute('disabled');
            skipButton.setAttribute('disabled', 'true');
            notPresentButton.setAttribute('disabled', 'true');
            isDrawingDisabled = true;
        }
    }
    

    // Initialize canvas size based on container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    let isDrawing = false, isDragging = false, isResizing = false;  
    let startX, startY, dragOffsetX, dragOffsetY, resizeDirection;
    let rect = { x: 0, y: 0, width: 0, height: 0 };

    function getRectangleCorners() {
        const scaleCoefficient = image.naturalWidth / image.clientWidth;

        return {
            topLeft: {
                x: rect.x * scaleCoefficient,
                y: rect.y * scaleCoefficient
            },
            topRight: {
                x: (rect.x + rect.width) * scaleCoefficient,
                y: rect.y * scaleCoefficient
            },
            bottomLeft: {
                x: rect.x * scaleCoefficient,
                y: (rect.y + rect.height) * scaleCoefficient
            },
            bottomRight: {
                x: (rect.x + rect.width) * scaleCoefficient,
                y: (rect.y + rect.height) * scaleCoefficient
            }
        };
    }

    function updateButtonState() {
        if (rect.width > 0 && rect.height > 0) {
            nextButton.disabled = false;
        } else {
            nextButton.disabled = true;
        }
    }
    
    // Mouse down event
    canvas.addEventListener('mousedown', (e) => {
        if (isFirstDraw) {
            startToDrawEnd = Date.now();
            drawToNextStart = Date.now(); // Draw-to-Next timestamp starts
            isFirstDraw = false;
        }

        if (isDrawingDisabled) return;

        const { offsetX, offsetY } = e;
        if (isCorner(offsetX, offsetY)) {
            isResizing = true;
            resizeDirection = getResizeDirection(offsetX, offsetY);
        } else if (isInsideRect(offsetX, offsetY)) {
            isDragging = true;
            dragOffsetX = offsetX - rect.x;
            dragOffsetY = offsetY - rect.y;
        } else {
            isDrawing = true;
            startX = offsetX;
            startY = offsetY;
            rect = { x: startX, y: startY, width: 0, height: 0 };
        }
    });

    // Mouse move event
    canvas.addEventListener('mousemove', (e) => {
        if (isDrawingDisabled) return;
 
        const { offsetX, offsetY } = e;
        if (isDrawing) {
            rect.width = Math.max(0, offsetX - startX);
            rect.height = Math.max(0, offsetY - startY);
        } else if (isDragging) {
            rect.x = Math.min(Math.max(offsetX - dragOffsetX, 0), canvas.width - rect.width);
            rect.y = Math.min(Math.max(offsetY - dragOffsetY, 0), canvas.height - rect.height);
        } else if (isResizing) {
            resizeRectangle(offsetX, offsetY);
        }
        drawCanvas();
    });

    // Mouse up event
    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
        isDragging = false;
        isResizing = false;
    });

    // Function to draw the rectangle and corner handles
    function drawCanvas() {
        if (isDrawingDisabled) return;
 
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#a9000e';
        ctx.lineWidth = 2;

        if (rect.width > 0 && rect.height > 0) {
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            drawHandles();
        }

        updateButtonState();
    }

    // Draw corner handles with dynamic size
    function drawHandles() {
        const minDim = Math.min(rect.width, rect.height);

        const handleLength = Math.max(0.06, minDim * 0.07); // Scale handles based on rectangle size

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(rect.x, rect.y);
        ctx.lineTo(rect.x + handleLength, rect.y);
        ctx.moveTo(rect.x, rect.y);
        ctx.lineTo(rect.x, rect.y + handleLength);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.width, rect.y);
        ctx.lineTo(rect.x + rect.width - handleLength, rect.y);
        ctx.moveTo(rect.x + rect.width, rect.y);
        ctx.lineTo(rect.x + rect.width, rect.y + handleLength);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(rect.x, rect.y + rect.height);
        ctx.lineTo(rect.x + handleLength, rect.y + rect.height);
        ctx.moveTo(rect.x, rect.y + rect.height);
        ctx.lineTo(rect.x, rect.y + rect.height - handleLength);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.width, rect.y + rect.height);
        ctx.lineTo(rect.x + rect.width - handleLength, rect.y + rect.height);
        ctx.moveTo(rect.x + rect.width, rect.y + rect.height);
        ctx.lineTo(rect.x + rect.width, rect.y + rect.height - handleLength);
        ctx.stroke();
    }

    // Check if a point is inside the rectangle
    function isInsideRect(x, y) {
        return x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height;
    }

    // Check if a point is near a corner handle for resizing
    function isCorner(x, y) {
        return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].some(corner => isInHandle(x, y, corner));
    }

    // Check if point is inside a specific handle
    function isInHandle(x, y, corner) {
        const minDim = Math.min(rect.width, rect.height);
        const handleLength = Math.max(5, minDim * 0.1);
        const corners = {
            'top-left': { x: rect.x, y: rect.y },
            'top-right': { x: rect.x + rect.width, y: rect.y },
            'bottom-left': { x: rect.x, y: rect.y + rect.height },
            'bottom-right': { x: rect.x + rect.width, y: rect.y + rect.height }
        };
        const { x: hx, y: hy } = corners[corner];
        return x >= hx - handleLength && x <= hx + handleLength && y >= hy - handleLength && y <= hy + handleLength;
    }

    // Get the resize direction based on the corner
    function getResizeDirection(x, y) {
        if (isInHandle(x, y, 'top-left')) return 'top-left';
        if (isInHandle(x, y, 'top-right')) return 'top-right';
        if (isInHandle(x, y, 'bottom-left')) return 'bottom-left';
        if (isInHandle(x, y, 'bottom-right')) return 'bottom-right';
        return '';
    }

    // Resize the rectangle based on the mouse position and resize direction
    function resizeRectangle(x, y) {
        switch (resizeDirection) {
            case 'top-left':
                rect.width += rect.x - x;
                rect.height += rect.y - y;
                rect.x = x;
                rect.y = y;
                break;
            case 'top-right':
                rect.width = x - rect.x;
                rect.height += rect.y - y;
                rect.y = y;
                break;
            case 'bottom-left':
                rect.width += rect.x - x;
                rect.x = x;
                rect.height = y - rect.y;
                break;
            case 'bottom-right':
                rect.width = x - rect.x;
                rect.height = y - rect.y;
                break;
        }

        // Ensure the rectangle stays within canvas boundaries when resizing
        rect.width = Math.max(0, Math.min(rect.width, canvas.width - rect.x));
        rect.height = Math.max(0, Math.min(rect.height, canvas.height - rect.y));
    }

    function resetRectangle() {
        rect = { x: 0, y: 0, width: 0, height: 0 };
        drawCanvas(); // Redraws the canvas to clear the rectangle
        updateButtonState();
    }

    function changeNextWordToImage() {
        nextButton.textContent = "Next Image";
        nextButton.removeAttribute('disabled');
        endButton.removeAttribute('disabled');
        skipButton.setAttribute('disabled', 'true');
        notPresentButton.setAttribute('disabled', 'true');
        isDrawingDisabled = true;
    }

    function resetTimestamps() {
        isFirstDraw = true;
        startToDrawStart = Date.now();
    }

    nextButton.addEventListener('click', function () {
        if (nextButton.textContent.trim() === "Next Keyword" ) {

            const currentKeyword = document.querySelector('.current_keyword');
            
            if (currentKeyword) {
                let medData = window.annotatedMedData;
                const corners = getRectangleCorners();

                const annotatedMedData = {
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
                    BoxCoordinates: `[(${corners.topLeft.x},${corners.topLeft.y}),(${corners.bottomLeft.x},${corners.bottomLeft.y}),(${corners.bottomRight.x},${corners.bottomRight.y}),(${corners.topRight.x},${corners.topRight.y})]`,
                    ExtractedKeyword: currentKeyword.textContent,
                    PressedButton: "Next Keyword",
                    Timestamps: `(${(startToDrawEnd - startToDrawStart) / 1000},${(Date.now() - drawToNextStart) / 1000})`
                };                          

                fetch('/MedData/ProcessAnnotatedMedData', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(annotatedMedData)
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        let currentIndex = Number(currentKeyword.id.split('-')[1]);

                        currentKeyword.classList.remove('current_keyword');
                        currentKeyword.classList.add('annotated_keyword');
                        keywordStates[currentIndex] = 2;

                        const nextKeyword = currentKeyword.nextElementSibling;

                        if (nextKeyword && nextKeyword.classList.contains('not_annotated_keyword')) {
                            nextKeyword.classList.remove('not_annotated_keyword');
                            nextKeyword.classList.add('current_keyword');
                            keywordStates[currentIndex+1] = 3;

                            localStorage.setItem('keywordStates', JSON.stringify(keywordStates));
                        } else {
                            resetRectangle();
                            changeNextWordToImage();
                            localStorage.setItem('keywordStates', JSON.stringify(keywordStates));
                            return;
                        }
                        
                        resetRectangle();
                        resetTimestamps();
                    } else {
                        console.error("Failed to process data.");
                    }
                })
                .catch(error => console.error('Error:', error));
            }
        } else {
            fetch(`/MedData/NextImage?medDataId=${window.annotatedMedData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    localStorage.removeItem('keywordStates');
                    location.reload();
                } else {
                    console.error("Failed to process data.");
                }
            })
            .catch(error => console.error('Error:', error));
        }
    });

    

    function skipOrNotPresentHandler(event) {
        const currentKeyword = document.querySelector('.current_keyword');
        if (currentKeyword) {
            let medData = window.annotatedMedData;
            
            const annotatedMedData = {
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
                PressedButton: event.target.id === 'skip-button' ? "I Don't Know" : "Not Present",
                ExtractedKeyword: currentKeyword.textContent,
            };            

            fetch('/MedData/ProcessAnnotatedMedData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(annotatedMedData)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {

                    let currentIndex = Number(currentKeyword.id.split('-')[1]);

                    currentKeyword.classList.remove('current_keyword');
                    currentKeyword.classList.add('skipped_keyword');
                    keywordStates[currentIndex] = 4;

                    const nextKeyword = currentKeyword.nextElementSibling;

                    if (nextKeyword && nextKeyword.classList.contains('not_annotated_keyword')) {
                        nextKeyword.classList.remove('not_annotated_keyword');
                        nextKeyword.classList.add('current_keyword');
                        keywordStates[currentIndex+1] = 3;
                        
                        localStorage.setItem('keywordStates', JSON.stringify(keywordStates));
                    } else {
                        resetRectangle();
                        changeNextWordToImage();
                        localStorage.setItem('keywordStates', JSON.stringify(keywordStates));
                        return;
                    }
                    
                    resetRectangle();

                    startToDrawStart = Date.now();
                } else {
                    console.error("Failed to process data.");
                }
            })
            .catch(error => console.error('Error:', error));
        }
    }

    skipButton.addEventListener('click', skipOrNotPresentHandler);

    notPresentButton.addEventListener('click', skipOrNotPresentHandler);
});