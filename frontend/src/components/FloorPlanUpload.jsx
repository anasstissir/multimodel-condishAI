import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  CheckCircle,
  LogIn,
  LogOut,
  Camera,
  FileCheck,
  FileText,
  DollarSign
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { analyzeFloorPlan, generate3DImage, processLeaseDocument, generate3DFromDocument } from '../api/client'

export default function FloorPlanUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [step, setStep] = useState('mode') // 'mode' | 'upload' | 'lease' | 'analyzing' | 'generating' | 'ready'
  const [uploadType, setUploadType] = useState('floor_plan') // 'floor_plan' | 'lease'
  
  const { 
    floorPlanImage, 
    setFloorPlanImage, 
    setFloorPlanData,
    setGenerated3DImage,
    setRooms,
    setCurrentView,
    inspectionMode,
    setInspectionMode,
    setLeaseInfo,
    checkInImages,
    rooms: existingRooms,
    floorPlanData: existingFloorPlan,
  } = useStore()

  // Check if we have existing check-in data
  const hasExistingData = existingRooms.length > 0 && Object.keys(checkInImages).length > 0
  const roomsWithCheckIn = Object.keys(checkInImages).filter(roomId => 
    checkInImages[roomId]?.images?.length > 0
  ).length

  const handleModeSelect = (mode) => {
    setInspectionMode(mode)
    
    // If check-out with existing data, skip upload
    if (mode === 'checkout' && hasExistingData) {
      setStep('ready')
      setTimeout(() => setCurrentView('3d-view'), 500)
    } else {
      setStep('upload')
    }
  }

  // Handle floor plan image
  const handleFloorPlanFile = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) return
    
    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageData = e.target.result
      setFloorPlanImage(imageData)
      
      setIsProcessing(true)
      setStep('analyzing')
      
      try {
        const base64 = imageData.split(',')[1]
        const analysisResult = await analyzeFloorPlan(base64)
        setFloorPlanData(analysisResult.floor_plan)
        setRooms(analysisResult.floor_plan?.rooms || [])
        
        setStep('generating')
        const image3DResult = await generate3DImage(base64)
        
        if (image3DResult.status === 'success') {
          setGenerated3DImage(image3DResult.image_base64)
        }
        
        setStep('ready')
        
        setTimeout(() => {
          if (inspectionMode === 'checkin') {
            setCurrentView('checkin')
          } else {
            setCurrentView('3d-view')
          }
        }, 1500)
        
      } catch (error) {
        console.error('Processing error:', error)
        setStep('upload')
      } finally {
        setIsProcessing(false)
      }
    }
    reader.readAsDataURL(file)
  }, [inspectionMode])

  // Handle lease document
  const handleLeaseFile = useCallback(async (file) => {
    if (!file) return
    
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PDF or image file')
      return
    }
    
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1]
      const mimeType = file.type
      
      setIsProcessing(true)
      setStep('analyzing')
      
      try {
        // Process lease document
        const leaseResult = await processLeaseDocument(base64, mimeType)
        
        if (leaseResult.lease_info) {
          setLeaseInfo(leaseResult.lease_info)
        }
        
        // Generate 3D if floor plan found
        if (leaseResult.floor_plan?.floor_plan_found || leaseResult.ready_for_inspection) {
          setStep('generating')
          
          const result3D = await generate3DFromDocument(base64, mimeType)
          
          if (result3D.status === 'success') {
            if (result3D.floor_plan) {
              setFloorPlanData(result3D.floor_plan)
              setRooms(result3D.floor_plan?.rooms || [])
            }
            if (result3D.image_3d?.image_base64) {
              setGenerated3DImage(result3D.image_3d.image_base64)
            }
          }
        }
        
        setStep('ready')
        
        setTimeout(() => {
          if (inspectionMode === 'checkin') {
            setCurrentView('checkin')
          } else {
            setCurrentView('3d-view')
          }
        }, 1500)
        
      } catch (error) {
        console.error('Lease processing error:', error)
        setStep('upload')
      } finally {
        setIsProcessing(false)
      }
    }
    reader.readAsDataURL(file)
  }, [inspectionMode])

  const handleFile = useCallback((file) => {
    if (uploadType === 'lease') {
      handleLeaseFile(file)
    } else {
      handleFloorPlanFile(file)
    }
  }, [uploadType, handleLeaseFile, handleFloorPlanFile])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  return (
    <div className="upload-container">
      <motion.div 
        className="upload-hero"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div 
          className="hero-badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <Sparkles size={16} />
          <span>AI-Powered Inspection</span>
        </motion.div>
        
        <h1 className="hero-title">
          Condish<span className="logo-dot">.ai</span>
          <br />
          <span className="gradient-text">Property Condition AI</span>
        </h1>
        
        <p className="hero-subtitle">
          Document property condition at move-in, compare at move-out
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* Mode Selection */}
        {step === 'mode' && (
          <motion.div 
            className="mode-selection"
            key="mode"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2 className="mode-title">What would you like to do?</h2>
            
            <div className="mode-cards">
              <motion.button
                className="mode-card checkin"
                onClick={() => handleModeSelect('checkin')}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="mode-icon">
                  <LogIn size={32} />
                </div>
                <h3>Check-In</h3>
                <p>New tenant moving in? Document the property's current condition with photos of each room.</p>
                <div className="mode-features">
                  <span><Camera size={14} /> Capture reference photos</span>
                  <span><FileCheck size={14} /> Room-by-room documentation</span>
                </div>
                <ArrowRight className="mode-arrow" size={20} />
              </motion.button>
              
              <motion.button
                className="mode-card checkout"
                onClick={() => handleModeSelect('checkout')}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="mode-icon">
                  <LogOut size={32} />
                </div>
                <h3>Check-Out</h3>
                <p>Tenant moving out? Compare current state with check-in photos to detect damages.</p>
                <div className="mode-features">
                  <span><Sparkles size={14} /> AI damage detection</span>
                  <span><FileCheck size={14} /> Automatic repair quotes</span>
                </div>
                {hasExistingData && (
                  <div className="existing-data-badge">
                    ✓ {roomsWithCheckIn} rooms with check-in photos
                  </div>
                )}
                <ArrowRight className="mode-arrow" size={20} />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Upload Zone */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="upload-section"
          >
            <div className="upload-mode-indicator">
              {inspectionMode === 'checkin' ? (
                <span className="mode-badge checkin"><LogIn size={16} /> Check-In Mode</span>
              ) : (
                <span className="mode-badge checkout"><LogOut size={16} /> Check-Out Mode</span>
              )}
              <button 
                className="change-mode-btn"
                onClick={() => setStep('mode')}
              >
                Change
              </button>
            </div>
            
            {/* Upload Type Selection */}
            <div className="upload-type-selector">
              <button 
                className={`type-btn ${uploadType === 'floor_plan' ? 'active' : ''}`}
                onClick={() => setUploadType('floor_plan')}
              >
                <Upload size={18} />
                Floor Plan Image
              </button>
              <button 
                className={`type-btn ${uploadType === 'lease' ? 'active' : ''}`}
                onClick={() => setUploadType('lease')}
              >
                <FileText size={18} />
                Lease Document
              </button>
            </div>
            
            <motion.div 
              className={`upload-zone ${isDragging ? 'dragging' : ''} ${floorPlanImage ? 'has-image' : ''} ${uploadType === 'lease' ? 'lease-mode' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => !isProcessing && document.getElementById('file-input').click()}
              whileHover={{ scale: isProcessing ? 1 : 1.02 }}
            >
              <input
                id="file-input"
                type="file"
                accept={uploadType === 'lease' ? '.pdf,image/*' : 'image/*'}
                onChange={(e) => handleFile(e.target.files[0])}
                hidden
              />
              
              {!floorPlanImage && (
                <div className="upload-placeholder">
                  <div className={`upload-icon ${uploadType === 'lease' ? 'lease-icon' : ''}`}>
                    {uploadType === 'lease' ? <FileText size={48} /> : <Upload size={48} />}
                  </div>
                  <h3>{uploadType === 'lease' ? 'Upload Lease Document' : 'Upload Floor Plan'}</h3>
                  <p>Drop your {uploadType === 'lease' ? 'lease document' : 'floor plan'} here or click to browse</p>
                  <div className="upload-formats">
                    {uploadType === 'lease' ? 'PDF, JPG, PNG' : 'PNG, JPG'}
                  </div>
                  {uploadType === 'lease' && (
                    <div className="lease-info-hint">
                      <DollarSign size={14} />
                      <span>Extracts: Floor plan, deposit, lease terms</span>
                    </div>
                  )}
                </div>
              )}
              
              {floorPlanImage && (
                <div className="upload-preview">
                  <img src={floorPlanImage} alt="Floor Plan" />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Processing States */}
        {(step === 'analyzing' || step === 'generating' || step === 'ready') && (
          <motion.div 
            className="processing-container"
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="preview-image">
              {floorPlanImage && <img src={floorPlanImage} alt="Floor Plan" />}
            </div>
            
            <div className="processing-status">
              {step === 'analyzing' && (
                <motion.div className="processing-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Loader2 className="spin" size={32} />
                  <span>Analyzing floor plan...</span>
                  <p>Identifying rooms and layout</p>
                </motion.div>
              )}
              
              {step === 'generating' && (
                <motion.div className="processing-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Sparkles className="pulse" size={32} />
                  <span>Generating 3D visualization...</span>
                  <p>Using Nano Banana AI</p>
                </motion.div>
              )}
              
              {step === 'ready' && (
                <motion.div 
                  className="processing-step success" 
                  initial={{ scale: 0.8, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <CheckCircle size={48} />
                  <span>Ready!</span>
                  <p>{inspectionMode === 'checkin' ? 'Proceeding to photo capture...' : 'Starting inspection...'}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Features */}
      {step === 'mode' && (
        <motion.div 
          className="features-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {[
            { icon: '🏠', title: 'Smart Analysis', desc: 'AI identifies all rooms' },
            { icon: '🎨', title: '3D Generation', desc: 'Beautiful visualizations' },
            { icon: '📸', title: 'Photo Compare', desc: 'Before/after matching' },
            { icon: '📊', title: 'Repair Quotes', desc: 'Instant cost estimates' },
          ].map((feature, i) => (
            <motion.div 
              key={i}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <span className="feature-icon">{feature.icon}</span>
              <h4>{feature.title}</h4>
              <p>{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
