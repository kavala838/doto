import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCurrentISOWeek } from '../utils/dateUtils';
import { enhanceGoalDescription } from '../services/aiService';
import { DateTime } from 'luxon';
import type { Goal } from '../types';

interface EditGoalModalProps {
  goal: Goal;
  onClose: () => void;
}

interface WeekOption {
  value: string;
  label: string;
  date: string;
}

const EditGoalModal: React.FC<EditGoalModalProps> = ({ goal, onClose }) => {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description);
  const [enhancedDescription, setEnhancedDescription] = useState('');
  const [duration, setDuration] = useState(goal.duration ? String(goal.duration) : '1');
  const [useTimeframe, setUseTimeframe] = useState(goal.week !== null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'edit' | 'preview'>('edit');
  const [startWeek, setStartWeek] = useState(goal.week || getCurrentISOWeek());
  const [selectedTags, setSelectedTags] = useState<string[]>(goal.tags || []);
  
  const { data, updateGoals, saveData } = useAppContext();

  // Generate week options for the next 12 weeks
  const weekOptions = useMemo(() => {
    const options: WeekOption[] = [];
    const currentWeek = getCurrentISOWeek();
    const [currentYear, currentWeekNum] = currentWeek.split('-').map(Number);
    const now = DateTime.fromObject({ 
      weekYear: currentYear, 
      weekNumber: currentWeekNum 
    });
    
    // Add current week and next 11 weeks
    for (let i = 0; i < 12; i++) {
      const weekDate = now.plus({ weeks: i });
      const weekValue = `${weekDate.weekYear}-${weekDate.weekNumber.toString().padStart(2, '0')}`;
      const startDate = weekDate.startOf('week').toFormat('MMM d, yyyy');
      const endDate = weekDate.endOf('week').toFormat('MMM d, yyyy');
      
      let label = weekValue === currentWeek 
        ? `Current Week (${weekValue})` 
        : `Week ${weekValue}`;
      
      options.push({
        value: weekValue,
        label,
        date: `${startDate} - ${endDate}`
      });
    }
    
    return options;
  }, []);

  // Calculate start and end dates based on selected week and duration
  const dateInfo = useMemo(() => {
    // Ensure startWeek is a string before splitting
    const startWeekStr = String(startWeek);
    const [year, week] = startWeekStr.split('-').map(Number);
    
    // Create start date from ISO week
    const startDate = DateTime.fromObject({ 
      weekYear: year, 
      weekNumber: week 
    });
    
    // Calculate end date based on duration
    const durationWeeks = parseInt(duration) || 1;
    const endDate = startDate.plus({ weeks: durationWeeks - 1 }); // -1 because duration includes the start week
    
    return {
      startDate: startDate.toFormat('MMM d, yyyy'),
      endDate: endDate.endOf('week').toFormat('MMM d, yyyy'), // End of the last week
      startWeek,
      endWeek: `${endDate.weekYear}-${endDate.weekNumber.toString().padStart(2, '0')}`
    };
  }, [startWeek, duration]);

  const handleEnhanceDescription = async () => {
    if (!description) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Enhance the description using OpenAI
      const enhanced = await enhanceGoalDescription(description);
      setEnhancedDescription(enhanced);
      setStep('preview');
    } catch (error) {
      console.error('Error enhancing description:', error);
      setError('Failed to enhance description. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    // Validate required fields
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    
    // Create updated goal object
    const updatedGoal: Goal = {
      ...goal,
      title: title.trim(),
      description: description.trim(),
      tags: selectedTags
    };
    
    console.log("Saving updated goal:", updatedGoal);
    
    // Update the goal in the goals array
    const updatedGoals = data.goals.map(g => 
      g.id === goal.id ? updatedGoal : g
    );
    
    // Update the goals in the app context
    updateGoals(updatedGoals);
    
    // Force save to ensure changes are persisted
    saveData().then(() => {
      console.log("Goal updated and saved successfully");
      onClose();
    });
  };

  const handleEditDescription = () => {
    setStep('edit');
  };

  const handleStartWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStartWeek(e.target.value);
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prevTags => {
      if (prevTags.includes(tagId)) {
        return prevTags.filter(id => id !== tagId);
      } else {
        return [...prevTags, tagId];
      }
    });
  };

  // Sort tags to show hot tags first
  const sortedTags = useMemo(() => {
    return [...(data.tags || [])].sort((a, b) => {
      if (a.isHot && !b.isHot) return -1;
      if (!a.isHot && b.isHot) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [data.tags]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          disabled={isSubmitting}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            border: 'none',
            background: 'none',
            fontSize: '20px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1
          }}
        >
          ×
        </button>
        
        <h2 style={{ marginTop: '0', marginBottom: '20px' }}>Edit Goal</h2>
        
        {error && (
          <div style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            {error}
          </div>
        )}
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Title*
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '16px'
            }}
          />
        </div>
        
        {step === 'edit' ? (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Description*
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                disabled={isSubmitting}
                rows={6}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '16px',
                  resize: 'vertical'
                }}
              />
              <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                You can enhance this description with AI to include Summary and Topics sections, or update the goal with the description as-is.
              </small>
            </div>
            
            {/* Tags selection */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {sortedTags.map(tag => (
                  <div
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      backgroundColor: selectedTags.includes(tag.id) ? tag.color : '#f1f1f1',
                      color: selectedTags.includes(tag.id) ? 'white' : '#333',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      border: selectedTags.includes(tag.id) ? 'none' : '1px solid #ddd'
                    }}
                  >
                    {tag.name}
                    {tag.isHot && (
                      <span style={{ marginLeft: '4px', fontSize: '12px' }}>🔥</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={useTimeframe}
                  onChange={() => setUseTimeframe(!useTimeframe)}
                  disabled={isSubmitting}
                  style={{ marginRight: '8px' }}
                />
                Add timeframe
              </label>
            </div>
            
            {useTimeframe && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Start Week
                  </label>
                  <select
                    value={startWeek}
                    onChange={handleStartWeekChange}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '16px',
                      backgroundColor: '#fff'
                    }}
                  >
                    {weekOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.date})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Duration (weeks)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    required={useTimeframe}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '16px'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    End Week
                  </label>
                  <div style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '16px',
                    backgroundColor: '#f5f5f5',
                    color: '#666'
                  }}>
                    {dateInfo.endWeek} ({dateInfo.endDate})
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f1f1f1',
                  marginRight: '10px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!title || !description || isSubmitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  cursor: (title && description && !isSubmitting) ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  opacity: (title && description && !isSubmitting) ? 1 : 0.7
                }}
              >
                Update Goal
              </button>
              <button
                type="button"
                onClick={handleEnhanceDescription}
                disabled={!description || isSubmitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #3f51b5',
                  backgroundColor: '#fff',
                  color: '#3f51b5',
                  marginLeft: '10px',
                  cursor: (description && !isSubmitting) ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  opacity: (description && !isSubmitting) ? 1 : 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isSubmitting ? (
                  <>
                    <span style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid #3f51b5',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      marginRight: '8px',
                      animation: 'spin 1s linear infinite'
                    }}></span>
                    Processing...
                  </>
                ) : (
                  'Enhance with AI'
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Original Description
                </label>
                <div style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#f9f9f9',
                  fontSize: '16px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {description}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  AI-Enhanced Description
                </label>
                <textarea
                  value={enhancedDescription}
                  onChange={(e) => setEnhancedDescription(e.target.value)}
                  rows={10}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '16px',
                    resize: 'vertical'
                  }}
                />
                <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                  You can edit the AI-enhanced description if needed.
                </small>
              </div>
              
              {/* Tags selection in preview mode */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Tags
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {sortedTags.map(tag => (
                    <div
                      key={tag.id}
                      onClick={() => handleTagToggle(tag.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        backgroundColor: selectedTags.includes(tag.id) ? tag.color : '#f1f1f1',
                        color: selectedTags.includes(tag.id) ? 'white' : '#333',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                        border: selectedTags.includes(tag.id) ? 'none' : '1px solid #ddd'
                      }}
                    >
                      {tag.name}
                      {tag.isHot && (
                        <span style={{ marginLeft: '4px', fontSize: '12px' }}>🔥</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleEditDescription}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f1f1f1',
                  marginRight: '10px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Edit Description
              </button>
              <button
                type="button"
                onClick={handleEnhanceDescription}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #3f51b5',
                  backgroundColor: '#f1f1f1',
                  color: '#3f51b5',
                  marginRight: '10px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!title || !enhancedDescription}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  cursor: (title && enhancedDescription) ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  opacity: (title && enhancedDescription) ? 1 : 0.7
                }}
              >
                Update Goal
              </button>
            </div>
          </>
        )}
        
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default EditGoalModal; 