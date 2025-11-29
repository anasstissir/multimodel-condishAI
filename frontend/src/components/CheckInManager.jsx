import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Camera, 
  Upload, 
  X, 
  CheckCircle, 
  Circle,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  Trash2,
  Plus,
  Save,
  ArrowRight
} from 'lucide-react'
import { useStore } from '../store/useStore'

export default function CheckInManager() {
  const {
    rooms,
    checkInImages,
    addCheckInImage,
    removeCheckInImage,
    updateCheckInProgress,
    checkInProgress,
    setCurrentView,
    generated3DImage,
  } = useStore()
  
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0)
  const [isCapturing, setIsCapturing] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null) // Keep track of stream for cleanup
  
  const currentRoom = rooms[selectedRoomIndex]
  const roomImages = checkInImages[currentRoom?.id]?.images || []
  
  // Calculate completion
  const completedRooms = rooms.filter(room => 
    checkInImages[room.id]?.images?.length > 0
  ).length
  
  // Cleanup camera on unmount or view change
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])
  
  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      setCameraStream(stream)
      setIsCapturing(true)
    } catch (err) {
      console.error('Camera error:', err)
      alert('Could not access camera. Please check permissions.')
    }
  }
  
  // Attach stream to video element when it's ready
  useEffect(() => {
    if (isCapturing && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
    }
  }, [isCapturing, cameraStream])
  
  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraStream(null)
    setIsCapturing(false)
  }, [])
  
  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    addCheckInImage(currentRoom.id, imageBase64)
    updateCheckInProgress()
    
    // Flash effect
    const flash = document.createElement('div')
    flash.className = 'camera-flash'
    document.body.appendChild(flash)
    setTimeout(() => flash.remove(), 200)
  }
  
  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target.result.split(',')[1]
        addCheckInImage(currentRoom.id, base64)
        updateCheckInProgress()
      }
      reader.readAsDataURL(file)
    })
    
    e.target.value = ''
  }
  
  // Navigation
  const goToNextRoom = () => {
    if (selectedRoomIndex < rooms.length - 1) {
      stopCamera()
      setSelectedRoomIndex(selectedRoomIndex + 1)
    }
  }
  
  const goToPrevRoom = () => {
    if (selectedRoomIndex > 0) {
      stopCamera()
      setSelectedRoomIndex(selectedRoomIndex - 1)
    }
  }
  
  // Finish check-in
  const finishCheckIn = () => {
    stopCamera()
    setCurrentView('3d-view')
  }
  
  return (
    <div className="checkin-manager">
      {/* Header */}
      <div className="checkin-header">
        <div className="checkin-title">
          <span className="step-badge">Check-In</span>
          <h1>Capture Reference Photos</h1>
          <p>Take photos of each room in its current condition for future comparison</p>
        </div>
        
        <div className="checkin-progress">
          <div className="progress-stats">
            <span className="completed">{completedRooms}</span>
            <span className="separator">/</span>
            <span className="total">{rooms.length}</span>
            <span className="label">rooms documented</span>
          </div>
          <div className="progress-bar">
            <motion.div 
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${checkInProgress}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="checkin-content">
        {/* Room Navigator */}
        <div className="room-navigator">
          <h3>Property Rooms</h3>
          <div className="room-nav-list">
            {rooms.map((room, index) => {
              const hasImages = checkInImages[room.id]?.images?.length > 0
              const imageCount = checkInImages[room.id]?.images?.length || 0
              const isActive = index === selectedRoomIndex
              
              return (
                <motion.button
                  key={room.id}
                  className={`room-nav-item ${isActive ? 'active' : ''} ${hasImages ? 'completed' : ''}`}
                  onClick={() => {
                    stopCamera()
                    setSelectedRoomIndex(index)
                  }}
                  whileHover={{ x: 4 }}
                >
                  <div className="room-status">
                    {hasImages ? (
                      <CheckCircle size={20} className="check-icon" />
                    ) : (
                      <Circle size={20} className="pending-icon" />
                    )}
                  </div>
                  <div className="room-details">
                    <span className="room-name">{room.name}</span>
                    <span className="room-type">{room.type}</span>
                  </div>
                  {hasImages && (
                    <span className="image-count">{imageCount} 📷</span>
                  )}
                  {isActive && <ChevronRight size={18} className="active-arrow" />}
                </motion.button>
              )
            })}
          </div>
          
          {/* 3D Preview */}
          {generated3DImage && (
            <div className="mini-3d-preview">
              <h4>Property Overview</h4>
              <img 
                src={`data:image/png;base64,${generated3DImage}`} 
                alt="3D Floor Plan"
              />
            </div>
          )}
        </div>
        
        {/* Capture Area */}
        <div className="capture-area">
          <div className="capture-header">
            <div className="current-room-info">
              <h2>{currentRoom?.name}</h2>
              <span className="room-type-badge">{currentRoom?.type}</span>
            </div>
            
            <div className="room-nav-buttons">
              <button 
                className="nav-btn"
                onClick={goToPrevRoom}
                disabled={selectedRoomIndex === 0}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="room-counter">{selectedRoomIndex + 1} / {rooms.length}</span>
              <button 
                className="nav-btn"
                onClick={goToNextRoom}
                disabled={selectedRoomIndex === rooms.length - 1}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          
          {/* Camera / Upload Area */}
          <div className="capture-view">
            {isCapturing ? (
              <div className="camera-view">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="camera-feed"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {/* Camera Controls */}
                <div className="camera-overlay-controls">
                  <button className="capture-btn" onClick={capturePhoto}>
                    <div className="capture-ring" />
                  </button>
                  <button className="stop-camera-btn" onClick={stopCamera}>
                    <X size={20} />
                    Close Camera
                  </button>
                </div>
              </div>
            ) : (
              <div className="upload-options">
                <button className="option-btn camera" onClick={startCamera}>
                  <Camera size={32} />
                  <span>Open Camera</span>
                  <p>Take photos directly</p>
                </button>
                
                <div className="option-divider">
                  <span>or</span>
                </div>
                
                <button 
                  className="option-btn upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={32} />
                  <span>Upload Photos</span>
                  <p>From your device</p>
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>
          
          {/* Captured Images Gallery */}
          <div className="captured-gallery">
            <div className="gallery-header">
              <h3>
                <ImageIcon size={18} />
                Captured Photos ({roomImages.length})
              </h3>
              {roomImages.length > 0 && (
                <span className="gallery-hint">These will be used as reference for check-out inspection</span>
              )}
            </div>
            
            <div className="gallery-grid">
              <AnimatePresence>
                {roomImages.map((image, index) => (
                  <motion.div
                    key={index}
                    className="gallery-item"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                  >
                    <img src={`data:image/jpeg;base64,${image}`} alt={`Photo ${index + 1}`} />
                    <button 
                      className="remove-btn"
                      onClick={() => {
                        removeCheckInImage(currentRoom.id, index)
                        updateCheckInProgress()
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                    <span className="photo-number">{index + 1}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {roomImages.length === 0 && (
                <div className="empty-gallery">
                  <ImageIcon size={48} />
                  <p>No photos captured yet</p>
                  <span>Take photos or upload images of this room</span>
                </div>
              )}
              
              {roomImages.length > 0 && roomImages.length < 5 && (
                <button 
                  className="add-more-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus size={24} />
                  <span>Add More</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Tips */}
          <div className="capture-tips">
            <h4>📸 Photo Tips</h4>
            <ul>
              <li>Capture all walls, floor, and ceiling</li>
              <li>Include close-ups of any existing wear or marks</li>
              <li>Photograph fixtures, appliances, and outlets</li>
              <li>Good lighting helps detect issues later</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Footer Actions */}
      <div className="checkin-footer">
        <div className="footer-info">
          {completedRooms === rooms.length ? (
            <span className="all-complete">✓ All rooms documented!</span>
          ) : (
            <span className="remaining">{rooms.length - completedRooms} rooms remaining</span>
          )}
        </div>
        
        <div className="footer-actions">
          <button 
            className="skip-btn"
            onClick={finishCheckIn}
          >
            {completedRooms === 0 ? 'Skip Check-In' : 'Save & Continue'}
          </button>
          
          <button 
            className="finish-btn"
            onClick={finishCheckIn}
            disabled={completedRooms === 0}
          >
            <Save size={18} />
            Complete Check-In
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

