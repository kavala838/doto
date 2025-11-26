import React, { useState, useMemo } from 'react';
import type { Goal, Tag } from '../types';
import { getWeekInfo } from '../utils/dateUtils';
import EditGoalModal from './EditGoalModal';
import { useAppContext } from '../context/AppContext';

interface GoalDetailsModalProps {
  goal: Goal;
  onClose: () => void;
}

const GoalDetailsModal: React.FC<GoalDetailsModalProps> = ({ goal, onClose }) => {
  const weekInfo = goal.week !== undefined && goal.week !== null ? getWeekInfo(String(goal.week)) : null;
  const [showEditModal, setShowEditModal] = useState(false);
  const { data } = useAppContext();
  
  // Get goal tags
  const goalTags = useMemo(() => {
    if (!goal.tags || goal.tags.length === 0) return [];
    
    // Get tag objects from tag IDs
    return goal.tags
      .map(tagId => data.tags?.find(tag => tag.id === tagId))
      .filter(tag => tag !== undefined) as Tag[];
  }, [goal.tags, data.tags]);
  
  // Sort tags to show hot tags first
  const sortedTags = useMemo(() => {
    return [...goalTags].sort((a, b) => {
      if (a.isHot && !b.isHot) return -1;
      if (!a.isHot && b.isHot) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [goalTags]);
  
  const handleEditClick = () => {
    setShowEditModal(true);
    onClose(); // Close the details modal when opening the edit modal
  };
  
  return (
    <>
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
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          position: 'relative'
        }}>
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              border: 'none',
              background: 'none',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
          
          <h2 style={{ marginTop: '0', marginBottom: '15px' }}>{goal.title}</h2>
          
          {/* Display tags */}
          {sortedTags.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: '10px 0 5px', color: '#555' }}>Tags</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {sortedTags.map(tag => (
                  <div
                    key={tag.id}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      backgroundColor: tag.color,
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center'
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
          )}
          
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ margin: '10px 0 5px', color: '#555' }}>Description</h4>
            <p style={{ margin: '0', whiteSpace: 'pre-wrap' }}>{goal.description}</p>
          </div>
          
          {weekInfo && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: '10px 0 5px', color: '#555' }}>Time Period</h4>
              <p style={{ margin: '0' }}>
                {weekInfo.startDate} to {weekInfo.endDate}
              </p>
              <p style={{ margin: '5px 0 0', fontSize: '14px', color: '#666' }}>
                Week {goal.week}
                {goal.duration && goal.duration > 1 ? ` (${goal.duration} weeks)` : ''}
              </p>
            </div>
          )}
          
          {goal.childs && goal.childs.length > 0 && (
            <div>
              <h4 style={{ margin: '10px 0 5px', color: '#555' }}>Child Goals</h4>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                {goal.childs.map(child => (
                  <li key={child.id} style={{ margin: '5px 0' }}>{child.title}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleEditClick}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#3B82F6',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Edit Goal
            </button>
          </div>
        </div>
      </div>
      
      {showEditModal && (
        <EditGoalModal goal={goal} onClose={() => setShowEditModal(false)} />
      )}
    </>
  );
};

export default GoalDetailsModal; 