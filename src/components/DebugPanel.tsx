import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { saveRawJson, getRawJson, clearData } from '../utils/storageUtils';

const DebugPanel: React.FC = () => {
  const { data, saveData, lastSaved, setData } = useAppContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState('');
  
  const handleForceSave = () => {
    saveData();
  };
  
  const handleClearStorage = () => {
    if (window.confirm('Are you sure you want to clear local storage? This will delete all your data!')) {
      clearData();
      window.location.reload();
    }
  };
  
  const handleShowJsonEditor = () => {
    // Get the latest raw JSON from localStorage
    setJsonValue(getRawJson());
    setShowJsonEditor(true);
    setJsonError('');
  };
  
  const handleSaveJson = () => {
    try {
      // Parse the JSON to validate it
      const parsedData = JSON.parse(jsonValue);
      console.log("Parsed JSON data:", parsedData);
      
      // Save directly to localStorage
      saveRawJson(jsonValue)
        .then(saved => {
          if (saved) {
            // Update the app state to refresh components
            setData(parsedData);
            console.log("JSON data saved and app state updated");
            
            // Close the JSON editor
            setJsonError('');
            setShowJsonEditor(false);
          } else {
            setJsonError('Failed to save JSON data to localStorage');
          }
        })
        .catch(error => {
          setJsonError('Error saving JSON: ' + error.message);
        });
    } catch (error) {
      console.error("JSON parse error:", error);
      setJsonError('Invalid JSON: ' + (error as Error).message);
    }
  };
  
  if (!isExpanded) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          padding: '8px', 
          backgroundColor: '#f0f0f0', 
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        onClick={() => setIsExpanded(true)}
      >
        Debug
      </div>
    );
  }
  
  if (showJsonEditor) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: '10px', 
        left: '10px', 
        right: '10px',
        bottom: '10px',
        padding: '15px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '4px',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>JSON Editor</h3>
          <button 
            onClick={() => setShowJsonEditor(false)}
            style={{ 
              border: 'none', 
              background: 'none', 
              cursor: 'pointer', 
              fontSize: '16px' 
            }}
          >
            ×
          </button>
        </div>
        
        {jsonError && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            borderRadius: '4px',
            marginBottom: '10px'
          }}>
            {jsonError}
          </div>
        )}
        
        <textarea 
          value={jsonValue}
          onChange={(e) => setJsonValue(e.target.value)}
          style={{ 
            flex: 1,
            padding: '10px',
            fontFamily: 'monospace',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            resize: 'none'
          }}
        />
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => setShowJsonEditor(false)}
            style={{ 
              padding: '8px 12px', 
              backgroundColor: '#f1f1f1', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          
          <button 
            onClick={handleSaveJson}
            style={{ 
              padding: '8px 12px', 
              backgroundColor: '#4caf50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      width: '300px',
      padding: '15px', 
      backgroundColor: '#f0f0f0', 
      borderRadius: '4px',
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Debug Panel</h3>
        <button 
          onClick={() => setIsExpanded(false)}
          style={{ 
            border: 'none', 
            background: 'none', 
            cursor: 'pointer', 
            fontSize: '16px' 
          }}
        >
          ×
        </button>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Goals:</strong> {data.goals.length}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Tags:</strong> {data.tags?.length || 0}
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          {data.tags?.map(tag => (
            <li key={tag.id}>
              {tag.name} ({tag.id}) {tag.isHot && '🔥'}
            </li>
          ))}
        </ul>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Last Saved:</strong> {lastSaved ? lastSaved.toLocaleTimeString() : 'Never'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Goals with Tags:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          {data.goals.filter(g => g.tags && g.tags.length > 0).map(goal => (
            <li key={goal.id}>
              {goal.title} - {goal.tags?.length} tags
            </li>
          ))}
        </ul>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={handleForceSave}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#4caf50', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Force Save
        </button>
        
        <button 
          onClick={handleShowJsonEditor}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#3f51b5', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Edit JSON
        </button>
        
        <button 
          onClick={() => window.location.reload()}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#ff9800', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reload Page
        </button>
        
        <button 
          onClick={handleClearStorage}
          style={{ 
            padding: '8px 12px', 
            backgroundColor: '#f44336', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Storage
        </button>
      </div>
    </div>
  );
};

export default DebugPanel; 