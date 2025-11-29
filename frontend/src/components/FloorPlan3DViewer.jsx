import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Maximize2, RotateCw, Play, ZoomIn, ZoomOut, Download, Loader2, RefreshCw } from 'lucide-react'
import { useStore } from '../store/useStore'
import { generate3DImage } from '../api/client'

export default function FloorPlan3DViewer() {
  const [isZoomed, setIsZoomed] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const { generated3DImage, setGenerated3DImage, startInspection, selectedRoom, rooms, floorPlanImage } = useStore()
  
  const hasRooms = rooms.length > 0
  const hasImage = !!generated3DImage
  
  // Format the image URL properly
  const imageUrl = hasImage 
    ? (generated3DImage.startsWith('data:') ? generated3DImage : `data:image/png;base64,${generated3DImage}`)
    : null

  // Regenerate 3D image
  const handleRegenerate = async () => {
    if (!floorPlanImage) return
    setIsRegenerating(true)
    try {
      const base64 = floorPlanImage.startsWith('data:') 
        ? floorPlanImage.split(',')[1] 
        : floorPlanImage
      const result = await generate3DImage(base64)
      if (result.status === 'success' && result.image_base64) {
        setGenerated3DImage(result.image_base64)
      }
    } catch (error) {
      console.error('Regeneration error:', error)
    } finally {
      setIsRegenerating(false)
    }
  }

  const downloadImage = () => {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = 'condish-floor-plan-3d.png'
    link.click()
  }

  return (
    <div className="viewer-container">
      <div className="viewer-header">
        <h2>3D Floor Plan</h2>
        <div className="viewer-controls">
          <button 
            className="control-btn" 
            onClick={() => setIsZoomed(!isZoomed)}
            title="Toggle Zoom"
          >
            <ZoomIn size={18} />
          </button>
          <button 
            className="control-btn"
            onClick={handleRegenerate}
            disabled={isRegenerating || !floorPlanImage}
            title="Regenerate 3D"
          >
            <RefreshCw size={18} className={isRegenerating ? 'spin' : ''} />
          </button>
          <button 
            className="control-btn"
            onClick={downloadImage}
            disabled={!hasImage}
            title="Download Image"
          >
            <Download size={18} />
          </button>
          <button className="control-btn" title="Fullscreen">
            <Maximize2 size={18} />
          </button>
        </div>
      </div>
      
      <div className={`viewer-canvas ${isZoomed ? 'zoomed' : ''}`}>
        {isRegenerating ? (
          <div className="loading-3d">
            <Loader2 className="spin" size={48} />
            <p>Regenerating 3D visualization...</p>
            <span className="sub">Creating a new render</span>
          </div>
        ) : hasImage ? (
          <motion.div 
            className="generated-3d-display"
            key={generated3DImage?.substring(0, 50)} // Re-animate on new image
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img 
              src={imageUrl} 
              alt="AI Generated 3D Floor Plan" 
              className={isZoomed ? 'zoomed' : ''}
            />
            <div className="ai-badge">
              <span>🎨 AI Generated</span>
            </div>
          </motion.div>
        ) : (
          <div className="loading-3d">
            <Loader2 className="spin" size={48} />
            <p>Generating 3D visualization...</p>
            <span className="sub">This may take a moment</span>
          </div>
        )}
        
        {/* Room Info Overlay */}
        {selectedRoom && (
          <motion.div 
            className="room-info-overlay"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h3>{selectedRoom.name}</h3>
            <span className="room-type">{selectedRoom.type}</span>
            <div className="room-priority">
              Priority: <span className={selectedRoom.inspection_priority}>
                {selectedRoom.inspection_priority}
              </span>
            </div>
          </motion.div>
        )}
      </div>
      
      {hasRooms && (
        <motion.button
          className="start-inspection-btn"
          onClick={startInspection}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Play size={20} />
          <span>Start Guided Inspection</span>
        </motion.button>
      )}
      
      {!hasRooms && !hasImage && (
        <div className="empty-viewer-message">
          <p>Upload a floor plan to generate 3D visualization</p>
        </div>
      )}
    </div>
  )
}
