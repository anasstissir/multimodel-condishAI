import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  Circle, 
  ArrowRight, 
  MapPin, 
  AlertTriangle, 
  Camera,
  Image as ImageIcon
} from 'lucide-react'
import { useStore } from '../store/useStore'

export default function InspectionPanel() {
  const { 
    rooms, 
    selectedRoom, 
    selectRoom, 
    inspectedRooms,
    currentRoomIndex,
    inspectionProgress,
    damages,
    setCurrentView,
    checkInImages,
    inspectionMode
  } = useStore()

  const getRoomStatus = (roomId) => {
    if (inspectedRooms.includes(roomId)) return 'completed'
    if (selectedRoom?.id === roomId) return 'current'
    return 'pending'
  }

  const getRoomCheckInCount = (roomId) => {
    return checkInImages[roomId]?.images?.length || 0
  }

  return (
    <div className="inspection-panel">
      <div className="panel-header">
        <h2>
          {inspectionMode === 'checkout' ? 'Check-Out Inspection' : 'Inspection Route'}
        </h2>
        <div className="progress-ring">
          <svg viewBox="0 0 36 36">
            <path
              className="progress-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="progress-fill"
              strokeDasharray={`${inspectionProgress}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span>{Math.round(inspectionProgress)}%</span>
        </div>
      </div>

      <div className="room-list">
        {rooms.map((room, index) => {
          const status = getRoomStatus(room.id)
          const checkInCount = getRoomCheckInCount(room.id)
          
          return (
            <motion.div
              key={room.id}
              className={`room-item ${status}`}
              onClick={() => selectRoom(room.id)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ x: 5 }}
            >
              <div className="room-status-icon">
                {status === 'completed' ? (
                  <CheckCircle size={20} className="completed" />
                ) : status === 'current' ? (
                  <motion.div 
                    className="current-indicator"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <MapPin size={20} />
                  </motion.div>
                ) : (
                  <Circle size={20} className="pending" />
                )}
              </div>
              
              <div className="room-info">
                <span className="room-name">{room.name}</span>
                <span className="room-type">{room.type}</span>
              </div>
              
              <div className="room-badges">
                {/* Check-in image indicator */}
                {checkInCount > 0 && (
                  <span className="checkin-badge" title={`${checkInCount} check-in photo(s)`}>
                    <ImageIcon size={12} />
                    {checkInCount}
                  </span>
                )}
                
                {room.inspection_priority === 'high' && (
                  <span className="priority-badge high">High</span>
                )}
                {status === 'current' && (
                  <ArrowRight size={16} className="current-arrow" />
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Damages Summary */}
      {damages.length > 0 && (
        <motion.div 
          className="damages-summary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="summary-header">
            <AlertTriangle size={18} />
            <span>{damages.length} Damage(s) Found</span>
          </div>
          <div className="damages-list">
            {damages.slice(-3).map((damage, i) => (
              <div key={i} className="damage-item">
                <span className={`severity ${damage.severity}`}>
                  {damage.severity}
                </span>
                <span className="type">{damage.type}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Current Room Actions */}
      {selectedRoom && (
        <motion.div 
          className="room-actions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <button 
            className="action-btn primary"
            onClick={() => setCurrentView('inspection')}
          >
            <Camera size={18} />
            <span>Inspect {selectedRoom.name}</span>
          </button>
          
          {/* Show check-in photo count */}
          {getRoomCheckInCount(selectedRoom.id) > 0 && (
            <div className="room-checkin-info">
              <ImageIcon size={14} />
              <span>
                {getRoomCheckInCount(selectedRoom.id)} check-in photo(s) available for comparison
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Inspection Tips */}
      {selectedRoom?.inspection_tips && selectedRoom.inspection_tips.length > 0 && (
        <motion.div 
          className="tips-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h4>💡 Inspection Tips</h4>
          <ul>
            {selectedRoom.inspection_tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  )
}
