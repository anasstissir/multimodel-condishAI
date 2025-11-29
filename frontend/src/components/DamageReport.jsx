import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, 
  Download, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  RefreshCw,
  Wallet,
  ArrowRight,
  Building,
  X,
  Eye,
  EyeOff
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { getRepairQuote, calculateDepositDeductions } from '../api/client'

export default function DamageReport() {
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isLoadingDeductions, setIsLoadingDeductions] = useState(false)
  const [manualDeposit, setManualDeposit] = useState('')
  const [showDepositInput, setShowDepositInput] = useState(false)
  
  const { 
    damages, 
    rooms, 
    inspectedRooms, 
    repairQuote, 
    setRepairQuote,
    depositAmount,
    depositCurrency,
    depositDeductions,
    setDepositDeductions,
    setDeposit,
    leaseInfo,
    reset,
    inspectionMode,
    ignoreDamage,
    ignoredDamages,
    restoreDamage,
  } = useStore()

  const totalRooms = rooms.length
  const completedRooms = inspectedRooms.length
  const damageCount = damages.length
  
  // Parse deposit amount - check multiple sources
  const rawDepositAmount = depositAmount || leaseInfo?.security_deposit?.amount || 0
  const parsedDepositAmount = typeof rawDepositAmount === 'string' 
    ? parseFloat(rawDepositAmount) 
    : (rawDepositAmount || 0)
  const hasDeposit = parsedDepositAmount > 0
  const currency = depositCurrency || leaseInfo?.security_deposit?.currency || 'EUR'
  
  // Debug logging
  console.log('Deposit debug:', { 
    depositAmount, 
    leaseInfoDeposit: leaseInfo?.security_deposit,
    parsedDepositAmount, 
    hasDeposit,
    currency 
  })

  // Fetch repair quote
  const fetchQuote = async () => {
    setIsLoadingQuote(true)
    try {
      const quote = await getRepairQuote(damages, 'Europe', currency)
      setRepairQuote(quote)
      
      // Always calculate deductions when we have deposit
      if (hasDeposit) {
        await fetchDeductions(quote)
      }
    } catch (err) {
      console.error('Quote error:', err)
    } finally {
      setIsLoadingQuote(false)
    }
  }

  // Calculate deposit deductions
  const fetchDeductions = async (quote = repairQuote) => {
    console.log('fetchDeductions called with:', { parsedDepositAmount, hasDeposit, quote })
    
    if (!hasDeposit || parsedDepositAmount <= 0) {
      console.log('No deposit to calculate:', parsedDepositAmount)
      return
    }
    
    setIsLoadingDeductions(true)
    try {
      console.log('Calculating deductions:', { damages, parsedDepositAmount, currency, quote })
      
      // If we have a repair quote, use it to calculate deductions
      const repairTotal = quote?.summary?.grand_total || 0
      
      const deductions = await calculateDepositDeductions(
        damages,
        parsedDepositAmount,
        currency,
        quote
      )
      console.log('Deductions result:', deductions)
      
      // If API returned valid data, use it
      if (deductions && deductions.status === 'success') {
        setDepositDeductions(deductions)
      } else {
        // Fallback: calculate manually from repair quote
        const totalDeduction = Math.min(repairTotal, parsedDepositAmount)
        setDepositDeductions({
          original_deposit: parsedDepositAmount,
          currency: currency,
          total_deductions: totalDeduction,
          deposit_return: parsedDepositAmount - totalDeduction,
          deductions: damages.map(d => ({
            item: `${d.type} - ${d.location || 'Unknown location'}`,
            damage_severity: d.severity,
            deduction_amount: repairTotal / damages.length,
            justification: 'Based on repair estimate',
            is_beyond_normal_wear: true
          })),
          summary: `Based on ${damages.length} damage(s) found with estimated repair cost of ${repairTotal} ${currency}.`
        })
      }
    } catch (err) {
      console.error('Deductions error:', err)
      // Create a fallback deduction manually from repair quote
      const repairTotal = quote?.summary?.grand_total || 0
      const totalDeduction = Math.min(repairTotal, parsedDepositAmount)
      
      setDepositDeductions({
        original_deposit: parsedDepositAmount,
        currency: currency,
        total_deductions: totalDeduction,
        deposit_return: parsedDepositAmount - totalDeduction,
        deductions: [],
        summary: repairTotal > 0 
          ? `Estimated deduction of ${totalDeduction} ${currency} based on repair costs.`
          : "Unable to calculate exact deductions. Please review manually."
      })
    } finally {
      setIsLoadingDeductions(false)
    }
  }

  useEffect(() => {
    // Auto-fetch when we have data
    if (!repairQuote && !isLoadingQuote) {
      if (damages.length > 0) {
        fetchQuote()
      } else if (hasDeposit && !depositDeductions) {
        // No damages but we have deposit - full return
        setDepositDeductions({
          original_deposit: parsedDepositAmount,
          currency: currency,
          total_deductions: 0,
          deposit_return: parsedDepositAmount,
          deductions: [],
          summary: "No damages found - Full deposit to be returned!"
        })
      }
    }
  }, [damages.length, parsedDepositAmount])

  // Auto-calculate deductions when we have quote and deposit but no deductions
  useEffect(() => {
    if (repairQuote && hasDeposit && !depositDeductions && !isLoadingDeductions) {
      console.log('Auto-triggering deduction calculation...')
      fetchDeductions(repairQuote)
    }
  }, [repairQuote, hasDeposit, depositDeductions])

  const severityCounts = damages.reduce((acc, d) => {
    acc[d.severity] = (acc[d.severity] || 0) + 1
    return acc
  }, {})

  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return '0'
    return Number(amount).toLocaleString()
  }

  return (
    <div className="damage-report">
      <motion.div 
        className="report-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="report-icon">
          <FileText size={48} />
        </div>
        <h1>{inspectionMode === 'checkout' ? 'Check-Out Complete' : 'Inspection Complete'}</h1>
        <p>
          {inspectionMode === 'checkout' 
            ? 'Review damages and deposit deductions below'
            : 'Here\'s your damage assessment report'
          }
        </p>
      </motion.div>

      {/* Lease Info Summary (if available) */}
      {leaseInfo && (
        <motion.div 
          className="lease-summary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="lease-summary-header">
            <Building size={18} />
            <span>Property: {leaseInfo.property_address || 'Unknown'}</span>
          </div>
          {leaseInfo.tenant_name && (
            <span className="tenant-name">Tenant: {leaseInfo.tenant_name}</span>
          )}
        </motion.div>
      )}

      {/* Summary Cards */}
      <motion.div 
        className="summary-cards"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="summary-card rooms">
          <div className="card-icon">🏠</div>
          <div className="card-value">{completedRooms}/{totalRooms}</div>
          <div className="card-label">Rooms Inspected</div>
        </div>
        
        <div className="summary-card damages">
          <div className="card-icon">⚠️</div>
          <div className="card-value">{damageCount}</div>
          <div className="card-label">Damages Found</div>
        </div>
        
        {hasDeposit && (
          <div className="summary-card deposit">
            <div className="card-icon">💰</div>
            <div className="card-value">{formatAmount(parsedDepositAmount)}</div>
            <div className="card-label">Deposit ({currency})</div>
          </div>
        )}
      </motion.div>

      {/* Deposit Deductions (for checkout mode) */}
      {inspectionMode === 'checkout' && (
        <motion.div 
          className="deposit-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2>
            <Wallet size={20} />
            Deposit Settlement
          </h2>
          
          {/* Manual deposit input if none set */}
          {!hasDeposit && (
            <div className="deposit-input-section">
              <p>No deposit amount found. Enter the deposit to calculate deductions:</p>
              <div className="deposit-input-row">
                <input 
                  type="number" 
                  placeholder="Enter deposit amount"
                  value={manualDeposit}
                  onChange={(e) => setManualDeposit(e.target.value)}
                  className="deposit-input"
                />
                <select 
                  value={depositCurrency || 'EUR'}
                  onChange={(e) => setDeposit(parseFloat(manualDeposit) || 0, e.target.value)}
                  className="currency-select"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="MAD">MAD</option>
                  <option value="GBP">GBP</option>
                </select>
                <button 
                  className="set-deposit-btn"
                  onClick={() => {
                    if (manualDeposit) {
                      setDeposit(parseFloat(manualDeposit), depositCurrency || 'EUR')
                      setDepositDeductions(null) // Reset to trigger recalculation
                    }
                  }}
                >
                  Set Deposit
                </button>
              </div>
            </div>
          )}
          
          {isLoadingDeductions ? (
            <div className="loading-deductions">
              <Loader2 className="spin" size={32} />
              <span>Calculating deposit deductions...</span>
            </div>
          ) : hasDeposit && depositDeductions ? (
            <div className="deductions-content">
              {/* Deposit Flow */}
              <div className="deposit-flow">
                <div className="flow-item original">
                  <span className="flow-label">Original Deposit</span>
                  <span className="flow-amount">{formatAmount(depositDeductions.original_deposit)} {currency}</span>
                </div>
                <ArrowRight className="flow-arrow" />
                <div className="flow-item deductions">
                  <span className="flow-label">Total Deductions</span>
                  <span className="flow-amount negative">-{formatAmount(depositDeductions.total_deductions)} {currency}</span>
                </div>
                <ArrowRight className="flow-arrow" />
                <div className="flow-item return">
                  <span className="flow-label">To Return</span>
                  <span className="flow-amount">{formatAmount(depositDeductions.deposit_return)} {currency}</span>
                </div>
              </div>

              {/* Deduction Items */}
              {depositDeductions.deductions?.length > 0 && (
                <div className="deduction-items">
                  <h4>Deduction Breakdown</h4>
                  {depositDeductions.deductions.map((d, i) => (
                    <div key={i} className="deduction-item">
                      <div className="deduction-info">
                        <span className={`severity-tag ${d.damage_severity}`}>
                          {d.damage_severity}
                        </span>
                        <span className="deduction-desc">{d.item}</span>
                      </div>
                      <div className="deduction-amount">
                        -{formatAmount(d.deduction_amount)} {currency}
                      </div>
                      <div className="deduction-reason">{d.justification}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary for parties */}
              {depositDeductions.summary && (
                <div className="deduction-summary">
                  <p>{depositDeductions.summary}</p>
                </div>
              )}

              {damageCount === 0 && (
                <div className="full-return">
                  <CheckCircle size={24} />
                  <span>No damages found - Full deposit to be returned!</span>
                </div>
              )}
              
              {/* Recalculate button */}
              <button 
                className="recalculate-btn" 
                onClick={() => {
                  setDepositDeductions(null) // Reset first
                  setTimeout(() => fetchDeductions(repairQuote), 100) // Then recalculate
                }}
                disabled={isLoadingDeductions}
              >
                <RefreshCw size={16} className={isLoadingDeductions ? 'spin' : ''} />
                {isLoadingDeductions ? 'Calculating...' : 'Recalculate'}
              </button>
            </div>
          ) : hasDeposit ? (
            <button className="calculate-btn" onClick={() => fetchDeductions()}>
              <Wallet size={18} />
              Calculate Deposit Deductions
            </button>
          ) : null}
        </motion.div>
      )}

      {/* Damage Breakdown */}
      {damageCount > 0 && (
        <motion.div 
          className="damage-breakdown"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2>
            <AlertTriangle size={20} />
            Damage Breakdown
          </h2>
          
          <div className="severity-bars">
            {['critical', 'major', 'moderate', 'minor'].map(severity => (
              <div key={severity} className={`severity-bar ${severity}`}>
                <div className="bar-label">{severity}</div>
                <div className="bar-track">
                  <motion.div 
                    className="bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${(severityCounts[severity] || 0) / damageCount * 100}%` }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                  />
                </div>
                <div className="bar-count">{severityCounts[severity] || 0}</div>
              </div>
            ))}
          </div>

          <div className="damages-list">
            {damages.map((damage, i) => (
              <motion.div 
                key={i}
                className="damage-item-report"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
              >
                <div className={`damage-severity ${damage.severity}`}>
                  {damage.severity}
                </div>
                <div className="damage-info">
                  <span className="damage-type">{damage.type}</span>
                  <span className="damage-room">📍 {damage.room}</span>
                </div>
                <div className="damage-location">{damage.location}</div>
                <button 
                  className="dismiss-damage-btn"
                  onClick={() => ignoreDamage(damage, 'Dismissed from report')}
                  title="Not actual damage - remove from report"
                >
                  <X size={14} />
                  Dismiss
                </button>
              </motion.div>
            ))}
          </div>
          
          {/* Ignored/Dismissed Damages */}
          {ignoredDamages.length > 0 && (
            <div className="ignored-damages-section">
              <h4>
                <EyeOff size={16} />
                Dismissed Items ({ignoredDamages.length})
              </h4>
              <p className="ignored-note">These items were dismissed and won't be charged to the tenant.</p>
              <div className="ignored-list">
                {ignoredDamages.map((damage, i) => (
                  <div key={i} className="ignored-item">
                    <span className="ignored-type">{damage.type}</span>
                    <span className="ignored-room">{damage.room}</span>
                    <button 
                      className="restore-btn"
                      onClick={() => restoreDamage(i)}
                    >
                      <Eye size={14} />
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Repair Quote */}
      <motion.div 
        className="repair-quote-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2>
          <DollarSign size={20} />
          Repair Estimate
        </h2>
        
        {isLoadingQuote ? (
          <div className="loading-quote">
            <Loader2 className="spin" size={32} />
            <span>Generating repair quote...</span>
          </div>
        ) : repairQuote ? (
          <div className="quote-content">
            <div className="quote-total">
              <span className="label">Total Estimate</span>
              <span className="amount">
                {formatAmount(repairQuote.summary?.grand_total)} {currency}
              </span>
            </div>
            
            {repairQuote.materials?.length > 0 && (
              <div className="quote-section">
                <h4>Materials</h4>
                {repairQuote.materials.map((m, i) => (
                  <div key={i} className="quote-line">
                    <span>{m.name} ({m.quantity} {m.unit})</span>
                    <span>{formatAmount(m.total)} {currency}</span>
                  </div>
                ))}
              </div>
            )}
            
            {repairQuote.labor?.length > 0 && (
              <div className="quote-section">
                <h4>Labor</h4>
                {repairQuote.labor.map((l, i) => (
                  <div key={i} className="quote-line">
                    <span>{l.task} ({l.hours}h)</span>
                    <span>{formatAmount(l.total)} {currency}</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="quote-breakdown">
              <div className="breakdown-line">
                <span>Subtotal</span>
                <span>{formatAmount(repairQuote.summary?.subtotal)} {currency}</span>
              </div>
              <div className="breakdown-line">
                <span>Contingency (10%)</span>
                <span>{formatAmount(repairQuote.summary?.contingency_10_percent)} {currency}</span>
              </div>
              <div className="breakdown-line total">
                <span>Grand Total</span>
                <span>{formatAmount(repairQuote.summary?.grand_total)} {currency}</span>
              </div>
            </div>
          </div>
        ) : damageCount === 0 ? (
          <div className="no-repairs">
            <CheckCircle size={48} />
            <span>No repairs needed! Property is in good condition.</span>
          </div>
        ) : (
          <button className="refresh-quote-btn" onClick={fetchQuote}>
            <RefreshCw size={18} />
            Generate Quote
          </button>
        )}
      </motion.div>

      {/* Actions */}
      <motion.div 
        className="report-actions"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <button className="action-btn primary">
          <Download size={18} />
          Download PDF Report
        </button>
        <button className="action-btn secondary" onClick={reset}>
          <RefreshCw size={18} />
          Start New Inspection
        </button>
      </motion.div>
    </div>
  )
}
