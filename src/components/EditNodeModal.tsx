import React, { useState, useEffect } from 'react';

interface EditNodeModalProps {
  nodeId: string;
  title: string;
  description: string;
  onSave: (nodeId: string, title: string, description: string) => void;
  onClose: () => void;
}

const EditNodeModal: React.FC<EditNodeModalProps> = ({ 
  nodeId, 
  title, 
  description, 
  onSave, 
  onClose 
}) => {
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedDescription, setEditedDescription] = useState(description);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Focus the title input when the modal opens
    const titleInput = document.getElementById('node-title-input');
    if (titleInput) {
      titleInput.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate title
    if (!editedTitle.trim()) {
      setError('Title is required');
      return;
    }
    
    onSave(nodeId, editedTitle, editedDescription);
  };

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
      zIndex: 1000,
      backdropFilter: 'blur(3px)'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        border: '1px solid #E2E8F0',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ 
          margin: '0 0 20px 0', 
          color: '#1E293B',
          fontSize: '20px',
          fontWeight: 600
        }}>
          Edit Node
        </h3>
        
        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label 
              htmlFor="node-title-input" 
              style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: 500, 
                color: '#475569' 
              }}
            >
              Title*
            </label>
            <input
              id="node-title-input"
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <label 
              htmlFor="node-description-input" 
              style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontWeight: 500, 
                color: '#475569' 
              }}
            >
              Description
            </label>
            <textarea
              id="node-description-input"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '16px',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button 
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                color: '#64748B',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#3B82F6',
                color: 'white',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNodeModal; 