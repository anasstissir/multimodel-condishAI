import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Camera, 
  CameraOff, 
  Scan, 
  CheckCircle, 
  AlertTriangle, 
  SkipForward, 
  Loader2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  EyeOff
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { analyzeDamage } from '../api/client'

export default function CameraInspection() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null) // Keep track of stream for proper cleanup
  const [stream, setStream] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [capturedFrame, setCapturedFrame] = useState(null)
  const [showReference, setShowReference] = useState(false)
  const [referenceIndex, setReferenceIndex] = useState(0)
  const [ignoredFromScan, setIgnoredFromScan] = useState([]) // Track ignored items from current scan
  
  const { 
    selectedRoom, 
    completeRoom, 
    skipRoom,
    checkInImages,
    addDamage,
    inspectionMode,
    ignoreDamage,
    ignoredDamages
  } = useStore()

  // Get check-in images for current room
  const roomCheckInData = checkInImages[selectedRoom?.id]
  const referenceImages = roomCheckInData?.images || []
  const hasReferences = referenceImages.length > 0

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        }
      })
      streamRef.current = mediaStream
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error('Camera error:', err)
    }
  }, [])

  // Stop camera - use ref for reliable cleanup
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setStream(null)
  }, [])

  // Start camera on mount, stop on unmount
  useEffect(() => {
    startCamera()
    return () => {
      // Clean up camera when component unmounts (view changes)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Reset when room changes
  useEffect(() => {
    setAnalysisResult(null)
    setCapturedFrame(null)
    setReferenceIndex(0)
  }, [selectedRoom?.id])

  // Capture frame
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null
    
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    
    return canvas.toDataURL('image/jpeg', 0.9)
  }, [])

  // Analyze current frame
  const analyzeFrame = useCallback(async () => {
    const frameData = captureFrame()
    if (!frameData) return
    
    setCapturedFrame(frameData)
    setIsAnalyzing(true)
    setAnalysisResult(null)
    
    try {
      const frameBase64 = frameData.split(',')[1]
      
      // Use check-in images as references if available
      const refs = hasReferences ? referenceImages : []
      
      const result = await analyzeDamage(frameBase64, refs)
      
      // Normalize the result to ensure consistent structure
      const normalizedResult = {
        ...result,
        damage_found: result.damage_found || result.damages?.length > 0 || result.status === 'new_damage_found',
        damages: result.damages || [],
      }
      
      setAnalysisResult(normalizedResult)
      
      // Don't add damages here - they get added when completing the room
      // This prevents duplicates from multiple scans
    } catch (err) {
      console.error('Analysis error:', err)
      setAnalysisResult({ status: 'error', message: err.message })
    } finally {
      setIsAnalyzing(false)
    }
  }, [captureFrame, referenceImages, hasReferences, selectedRoom, addDamage])

  // Ignore a damage from current scan
  const handleIgnoreDamage = (index) => {
    const damageToIgnore = analysisResult?.damages?.[index]
    if (!damageToIgnore) return
    
    // Add to ignored list
    setIgnoredFromScan(prev => [...prev, index])
  }

  // Restore an ignored damage
  const handleRestoreDamage = (index) => {
    setIgnoredFromScan(prev => prev.filter(i => i !== index))
  }

  // Get active (non-ignored) damages from current scan
  const activeDamages = (analysisResult?.damages || []).filter((_, i) => !ignoredFromScan.includes(i))
  const ignoredCount = ignoredFromScan.length

  // Complete room inspection - add only non-ignored damages
  const handleComplete = () => {
    const newDamages = activeDamages.map(d => ({
      ...d,
      room: selectedRoom?.name,
      roomId: selectedRoom?.id,
      timestamp: new Date().toISOString(),
      hasImage: true,
    }))
    completeRoom(selectedRoom?.id, newDamages)
    setAnalysisResult(null)
    setCapturedFrame(null)
    setIgnoredFromScan([]) // Reset ignored for next room
  }

  const getStatusColor = () => {
    if (!analysisResult) return 'neutral'
    if (analysisResult.status === 'error') return 'error'
    if (analysisResult.status === 'wrong_room') return 'warning'
    // Check both damage_found AND if damages array has items
    if (analysisResult.damage_found || analysisResult.damages?.length > 0) return 'damage'
    if (analysisResult.status === 'scene_mismatch') return 'warning'
    return 'success'
  }

  // Determine if damage was actually found (check active damages after ignoring)
  const hasDamage = activeDamages.length > 0 || 
                    (analysisResult?.damage_found && ignoredFromScan.length === 0)
  
  // Check if wrong room detected
  const isWrongRoom = analysisResult?.status === 'wrong_room' || analysisResult?.same_room === false

  return (
    <div className="camera-inspection">
      <div className="camera-header">
        <div className="room-indicator">
          <span className="label">Inspecting:</span>
          <span className="room-name">{selectedRoom?.name || 'Unknown Room'}</span>
        </div>
        <div className="camera-status">
          {stream ? (
            <span className="status live">
              <Camera size={16} /> Live
            </span>
          ) : (
            <span className="status offline">
              <CameraOff size={16} /> Offline
            </span>
          )}
        </div>
      </div>

      {/* Reference Images Panel */}
      {hasReferences && (
        <div className="reference-panel">
          <div className="reference-header">
            <ImageIcon size={16} />
            <span>Check-In Reference ({referenceImages.length} photos)</span>
            <button 
              className="toggle-reference"
              onClick={() => setShowReference(!showReference)}
            >
              {showReference ? 'Hide' : 'Show'}
            </button>
          </div>
          
          <AnimatePresence>
            {showReference && (
              <motion.div 
                className="reference-gallery"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="reference-viewer">
                  <button 
                    className="ref-nav prev"
                    onClick={() => setReferenceIndex(Math.max(0, referenceIndex - 1))}
                    disabled={referenceIndex === 0}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  
                  <div className="ref-image-container">
                    <img 
                      src={`data:image/jpeg;base64,${referenceImages[referenceIndex]}`} 
                      alt={`Reference ${referenceIndex + 1}`}
                    />
                    <span className="ref-counter">
                      {referenceIndex + 1} / {referenceImages.length}
                    </span>
                  </div>
                  
                  <button 
                    className="ref-nav next"
                    onClick={() => setReferenceIndex(Math.min(referenceImages.length - 1, referenceIndex + 1))}
                    disabled={referenceIndex === referenceImages.length - 1}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                
                <div className="reference-info">
                  <span className="ref-date">
                    📅 Captured: {new Date(roomCheckInData.date).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* No Reference Warning */}
      {!hasReferences && inspectionMode === 'checkout' && (
        <div className="no-reference-warning">
          <AlertTriangle size={16} />
          <span>No check-in photos for this room. Comparison may be less accurate.</span>
        </div>
      )}

      <div className="camera-view">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="camera-feed"
        />
        <canvas ref={canvasRef} hidden />
        
        {/* Scanning overlay */}
        {isAnalyzing && (
          <motion.div 
            className="scanning-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="scan-line" />
            <div className="scan-text">
              <Loader2 className="spin" size={24} />
              <span>
                {hasReferences 
                  ? 'Comparing with check-in photos...' 
                  : 'Analyzing for damage...'}
              </span>
            </div>
          </motion.div>
        )}

        {/* Captured frame overlay */}
        {capturedFrame && !isAnalyzing && (
          <motion.div 
            className="captured-overlay"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <img src={capturedFrame} alt="Captured" />
          </motion.div>
        )}

        {/* Result overlay */}
        <AnimatePresence>
          {analysisResult && !isAnalyzing && (
            <motion.div 
              className={`result-overlay ${getStatusColor()}`}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
            >
              <div className="result-icon">
                {isWrongRoom ? (
                  <AlertTriangle size={32} />
                ) : hasDamage ? (
                  <AlertTriangle size={32} />
                ) : (
                  <CheckCircle size={32} />
                )}
              </div>
              <div className="result-content">
                {/* Wrong Room Warning */}
                {isWrongRoom ? (
                  <>
                    <h3>⚠️ Wrong Room!</h3>
                    <p>{analysisResult.message}</p>
                    <div className="wrong-room-details">
                      <div className="room-compare">
                        <div className="room-box reference">
                          <span className="room-label">Check-In Photo:</span>
                          <span className="room-desc">{analysisResult.reference_shows}</span>
                        </div>
                        <span className="vs">≠</span>
                        <div className="room-box current">
                          <span className="room-label">Current View:</span>
                          <span className="room-desc">{analysisResult.current_shows}</span>
                        </div>
                      </div>
                      {analysisResult.suggestion && (
                        <div className="room-suggestion">
                          💡 {analysisResult.suggestion}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3>
                      {activeDamages.length > 0
                        ? `🚨 ${activeDamages.length} NEW Damage(s) Found!` 
                        : ignoredCount > 0 
                        ? `✅ All ${ignoredCount} issue(s) dismissed`
                        : '✅ No New Damage - Property looks good!'}
                    </h3>
                    <p>{analysisResult.message}</p>
                    
                    {/* Ignored count indicator */}
                    {ignoredCount > 0 && (
                      <div className="ignored-count-badge">
                        <EyeOff size={14} />
                        <span>{ignoredCount} dismissed by you</span>
                      </div>
                    )}
                    
                    {/* Pre-existing conditions noted (not charged) */}
                    {analysisResult.pre_existing_noted?.length > 0 && (
                      <div className="pre-existing-note">
                        <span className="pre-existing-label">ℹ️ Pre-existing (not charged):</span>
                        <span>{analysisResult.pre_existing_noted.join(', ')}</span>
                      </div>
                    )}
                    
                    {/* Overall condition badge */}
                    {analysisResult.overall_condition && activeDamages.length > 0 && (
                      <div className={`condition-badge ${analysisResult.overall_condition}`}>
                        Condition: {analysisResult.overall_condition.toUpperCase()}
                      </div>
                    )}
                    
                    {/* Urgency indicator */}
                    {analysisResult.repair_urgency && analysisResult.repair_urgency !== 'none' && activeDamages.length > 0 && (
                      <div className={`urgency-badge ${analysisResult.repair_urgency}`}>
                        ⚡ Repair Urgency: {analysisResult.repair_urgency.toUpperCase()}
                      </div>
                    )}
                    
                    {/* Active damages */}
                    {analysisResult.damages?.length > 0 && (
                      <div className="damages-found">
                        {activeDamages.length > 0 && (
                          <div className="damages-header">💰 Tenant Responsibility:</div>
                        )}
                        {analysisResult.damages.map((d, i) => {
                          const isIgnored = ignoredFromScan.includes(i)
                          return (
                            <div key={i} className={`damage-item ${isIgnored ? 'ignored' : ''}`}>
                              <div className="damage-header">
                                <span className={`severity ${d.severity}`}>{d.severity}</span>
                                <span className="damage-type">{d.type?.replace('_', ' ')}</span>
                                {!isIgnored && <span className="new-badge">NEW</span>}
                                {isIgnored && <span className="ignored-badge">DISMISSED</span>}
                                
                                {/* Ignore/Restore button */}
                                {isIgnored ? (
                                  <button 
                                    className="restore-damage-btn"
                                    onClick={() => handleRestoreDamage(i)}
                                    title="Restore this damage"
                                  >
                                    <Eye size={14} />
                                    Restore
                                  </button>
                                ) : (
                                  <button 
                                    className="ignore-damage-btn"
                                    onClick={() => handleIgnoreDamage(i)}
                                    title="Not actual damage - dismiss"
                                  >
                                    <X size={14} />
                                    Dismiss
                                  </button>
                                )}
                              </div>
                              {!isIgnored && (
                                <div className="damage-details">
                                  <p className="damage-desc">{d.description}</p>
                                  {d.location && <span className="damage-loc">📍 {d.location}</span>}
                                  {d.size && <span className="damage-size">📐 {d.size}</span>}
                                  {d.likely_cause && <span className="damage-cause">💡 {d.likely_cause}</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Crosshair */}
        <div className="crosshair">
          <div className="h" />
          <div className="v" />
        </div>

        {/* Corner markers */}
        <div className="corner-markers">
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
        </div>
      </div>

      <div className="camera-controls">
        <motion.button
          className="scan-btn"
          onClick={analyzeFrame}
          disabled={isAnalyzing || !stream}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Scan size={20} />
          <span>{isAnalyzing ? 'Analyzing...' : 'Scan for Damage'}</span>
        </motion.button>

        <div className="secondary-controls">
          <motion.button
            className="complete-btn"
            onClick={handleComplete}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <CheckCircle size={18} />
            <span>Complete Room</span>
          </motion.button>
          
          <motion.button
            className="skip-btn"
            onClick={skipRoom}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <SkipForward size={18} />
            <span>Skip</span>
          </motion.button>
        </div>
      </div>

      {/* Tips */}
      <div className="inspection-tips">
        <h4>📋 What to check in {selectedRoom?.name}:</h4>
        <ul>
          <li>Walls - Look for cracks, stains, or holes</li>
          <li>Ceiling - Check for water damage or discoloration</li>
          <li>Floor - Inspect for scratches or damage</li>
          {selectedRoom?.type === 'bathroom' && (
            <>
              <li>Fixtures - Test all plumbing</li>
              <li>Tiles - Check for chips or loose tiles</li>
            </>
          )}
          {selectedRoom?.type === 'kitchen' && (
            <>
              <li>Cabinets - Open and check condition</li>
              <li>Appliances - Test if functional</li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}
