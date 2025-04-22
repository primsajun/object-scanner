document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const startMessage = document.getElementById('start-message');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');
    const scanButton = document.getElementById('scan-btn');
    const muteButton = document.getElementById('mute-btn');
  
    // Initialize Lucide icons
    lucide.createIcons();
  
    // State
    let model = null;
    let isDetecting = false;
    let isMuted = false;
    let animationId = null;
    let currentSpeech = null;
    let lastSpokenObjects = [];
    let lastSpeechTime = 0;
  
    // Canvas context
    const ctx = canvas.getContext('2d');
  
    // Hide loading initially
    loadingElement.style.display = 'none';
  
    // Load TensorFlow and COCO-SSD model
    async function loadModel() {
      try {
        loadingElement.style.display = 'flex';
        await tf.ready();
        model = await cocoSsd.load();
        loadingElement.style.display = 'none';
      } catch (err) {
        console.error('Failed to load model:', err);
        showError('Failed to load the object detection model. Please try again later.');
        loadingElement.style.display = 'none';
      }
    }
  
    // Setup camera
    async function setupCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError("Your browser doesn't support camera access.");
        return;
      }
  
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
  
        video.srcObject = stream;
        startMessage.style.display = 'none';
        
        // Wait for video to be ready
        return new Promise((resolve) => {
          video.onloadedmetadata = () => {
            resolve(video);
          };
        });
      } catch (err) {
        console.error('Error accessing camera:', err);
        showError('Unable to access your camera. Please grant permission and try again.');
      }
    }
  
    // Stop camera
    function stopCamera() {
      if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
      }
      startMessage.style.display = 'flex';
    }
  
    // Show error
    function showError(message) {
      errorMessage.textContent = message;
      errorElement.classList.remove('hidden');
    }
  
    // Hide error
    function hideError() {
      errorElement.classList.add('hidden');
    }
  
    // Detect objects
    async function detectObjects() {
      // Check if video is ready
      if (video.readyState !== 4) {
        animationId = requestAnimationFrame(detectObjects);
        return;
      }
  
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
  
      // Detect objects
      const predictions = await model.detect(video);
  
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
      // Draw bounding boxes and labels
      const currentObjects = [];
  
      predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const label = prediction.class;
        const score = prediction.score;
  
        if (score > 0.66) {
          // Only show high confidence predictions
          currentObjects.push(label);
  
          // Draw bounding box
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, width, height);
  
          // Draw background for label
          ctx.fillStyle = '#10b981';
          const textWidth = ctx.measureText(label).width;
          ctx.fillRect(x, y - 30, textWidth + 20, 30);
  
          // Draw label
          ctx.fillStyle = '#ffffff';
          ctx.font = '18px Arial';
          ctx.fillText(label, x + 10, y - 10);
        }
      });
  
      // Speak detected objects (if not muted)
      if (!isMuted && currentObjects.length > 0) {
        const now = Date.now();
        const uniqueObjects = [...new Set(currentObjects)];
  
        // Only speak if it's been at least 3 seconds since the last speech
        // and if the detected objects have changed
        const objectsChanged = !arraysEqual(uniqueObjects, lastSpokenObjects);
  
        if (objectsChanged && now - lastSpeechTime > 3000) {
          if (currentSpeech) {
            window.speechSynthesis.cancel();
          }
  
          const text = uniqueObjects.length === 1 
            ? `I see a ${uniqueObjects[0]}` 
            : `I see: ${uniqueObjects.join(', ')}`;
  
          currentSpeech = new SpeechSynthesisUtterance(text);
          window.speechSynthesis.speak(currentSpeech);
  
          lastSpokenObjects = uniqueObjects;
          lastSpeechTime = now;
        }
      }
  
      // Continue detection loop
      animationId = requestAnimationFrame(detectObjects);
    }
  
    // Helper function to compare arrays
    function arraysEqual(a, b) {
      if (a.length !== b.length) return false;
      return a.every((val, index) => val === b[index]);
    }
  
    // Toggle scanning
    async function toggleScanning() {
      if (isDetecting) {
        // Stop scanning
        isDetecting = false;
        scanButton.innerHTML = '<i data-lucide="camera" class="icon"></i> Start Scanning';
        scanButton.classList.remove('destructive');
        scanButton.classList.add('primary');
        
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
        
        stopCamera();
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        // Start scanning
        hideError();
        
        // Load model if not loaded
        if (!model) {
          await loadModel();
          if (!model) return; // Error loading model
        }
        
        // Setup camera
        await setupCamera();
        
        isDetecting = true;
        scanButton.innerHTML = '<i data-lucide="camera-off" class="icon"></i> Stop Scanning';
        scanButton.classList.remove('primary');
        scanButton.classList.add('destructive');
        
        // Start detection
        detectObjects();
      }
      
      // Update icons
      lucide.createIcons();
    }
  
    // Toggle mute
    function toggleMute() {
      isMuted = !isMuted;
      
      if (isMuted) {
        muteButton.innerHTML = '<i data-lucide="volume-x" class="icon"></i> Unmute';
        if (currentSpeech) {
          window.speechSynthesis.cancel();
        }
      } else {
        muteButton.innerHTML = '<i data-lucide="volume-2" class="icon"></i> Mute';
      }
      
      // Update icons
      lucide.createIcons();
    }
  
    // Event listeners
    scanButton.addEventListener('click', toggleScanning);
    muteButton.addEventListener('click', toggleMute);
  
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (currentSpeech) {
        window.speechSynthesis.cancel();
      }
      stopCamera();
    });
  });