import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Goal, Tag } from '../types';
import { calculateProgressWithDuration, calculateRemainingTime } from '../utils/dateUtils';
import GoalDetailsModal from './GoalDetailsModal';
import EditGoalModal from './EditGoalModal';
import { useAppContext } from '../context/AppContext';

interface GoalCardProps {
  goal: Goal;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const navigate = useNavigate();
  const { data, setData } = useAppContext();
  
  const progress = calculateProgressWithDuration(
    goal.week?.toString(), 
    goal.duration !== undefined ? goal.duration : null
  );
  const remainingTime = calculateRemainingTime(
    goal.week?.toString(), 
    goal.duration !== undefined ? goal.duration : null
  );
  
  // Get goal tags
  const goalTags = useMemo(() => {
    console.log("Getting tags for goal", { 
      goalId: goal.id, 
      hasTags: Boolean(goal.tags), 
      tagCount: goal.tags?.length || 0,
      tagIds: goal.tags || []
    });
    
    if (!goal.tags || goal.tags.length === 0) return [];
    
    // Get tag objects from tag IDs
    const foundTags = goal.tags
      .map(tagId => {
        const tag = data.tags?.find(t => t.id === tagId);
        if (!tag) {
          console.log("Tag not found", { tagId });
        }
        return tag;
      })
      .filter(tag => tag !== undefined) as Tag[];
      
    console.log("Found tags for goal", { 
      goalId: goal.id, 
      foundCount: foundTags.length,
      foundTags: foundTags.map(t => t.name)
    });
    
    return foundTags;
  }, [goal.tags, data.tags]);
  
  // Sort tags to show hot tags first
  const sortedTags = useMemo(() => {
    return [...goalTags].sort((a, b) => {
      if (a.isHot && !b.isHot) return -1;
      if (!a.isHot && b.isHot) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [goalTags]);
  
  const handleCardClick = () => {
    navigate(`/goal/${goal.id}`);
  };
  
  const handleEyeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetails(true);
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditModal(true);
  };
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };
  
  const handleDeleteConfirm = () => {
    // Filter out the goal with the matching ID
    const updatedGoals = data.goals.filter(g => g.id !== goal.id);
    
    // Update the data
    setData({
      ...data,
      goals: updatedGoals
    });
    
    // Close the confirmation dialog
    setShowDeleteConfirm(false);
  };
  
  return (
    <>
      <div 
        className="goal-card" 
        onClick={handleCardClick}
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '20px',
          margin: '12px',
          boxShadow: '0 3px 8px rgba(0, 0, 0, 0.08)',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: '#fff',
          width: '320px',
          height: '200px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.08)';
        }}
      >
        {/* Action buttons container */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          gap: '8px'
        }}>
          {/* Delete button */}
          <div 
            style={{
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              transition: 'all 0.2s ease'
            }}
            onClick={handleDeleteClick}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(254, 226, 226, 0.9)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Delete goal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </div>
          
          {/* Edit button */}
          <div 
            style={{
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              transition: 'all 0.2s ease'
            }}
            onClick={handleEditClick}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(226, 232, 240, 0.8)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Edit goal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </div>
          
          {/* View details button */}
          <div 
            style={{
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              transition: 'all 0.2s ease'
            }}
            onClick={handleEyeClick}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(226, 232, 240, 0.8)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="View details"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
        </div>

        <div>
          <h3 style={{ 
            margin: '0 0 14px 0', 
            fontSize: '20px', 
            fontWeight: 600, 
            color: '#1E293B',
            paddingRight: '100px', // Make space for the action buttons
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.3'
          }}>
            {goal.title}
          </h3>
          
          {/* Display tags */}
          {sortedTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {sortedTags.map(tag => (
                <div
                  key={tag.id}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: tag.color,
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {tag.name}
                  {tag.isHot && (
                    <span style={{ marginLeft: '4px', fontSize: '10px' }}>🔥</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Show remaining time instead of week/duration */}
          {remainingTime && (
            <p style={{ 
              margin: '8px 0', 
              fontSize: '15px', 
              color: remainingTime === 'Overdue' ? '#ef4444' : '#64748B',
              fontWeight: remainingTime === 'Overdue' ? 600 : 400
            }}>
              {remainingTime === 'Overdue' ? 'Overdue!' : `${remainingTime} remaining`}
            </p>
          )}
        </div>
        
        <div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ 
              height: '10px', 
              backgroundColor: '#e0e0e0', 
              borderRadius: '5px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: remainingTime === 'Overdue' ? '#ef4444' : '#3b82f6',
                borderRadius: '5px'
              }} />
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginTop: '8px',
              fontSize: '14px',
              color: '#64748B'
            }}>
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      </div>
      
      {showDetails && (
        <GoalDetailsModal goal={goal} onClose={() => setShowDetails(false)} />
      )}
      
      {showEditModal && (
        <EditGoalModal goal={goal} onClose={() => setShowEditModal(false)} />
      )}
      
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(5px)'
        }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E2E8F0',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#1E293B',
              fontSize: '18px',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              Delete "{goal.title}"?
            </h3>
            
            <p style={{
              margin: '0 0 24px 0',
              color: '#64748B',
              textAlign: 'center'
            }}>
              This action cannot be undone.
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  color: '#64748B',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F1F5F9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#EF4444',
                  color: 'white',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#EF4444';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GoalCard; 