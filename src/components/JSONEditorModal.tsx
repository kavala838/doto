import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { AppData } from '../types';
import { saveRawJson } from '../utils/storageUtils';

interface JSONEditorModalProps {
  onClose: () => void;
}

const JSONEditorModal: React.FC<JSONEditorModalProps> = ({ onClose }) => {
  const { data, setData } = useAppContext();
  const [jsonText, setJsonText] = useState(JSON.stringify(data, null, 2));
  const [error, setError] = useState<string | null>(null);
  
  const handleSave = async () => {
    try {
      // Parse the JSON to validate it
      const parsedData = JSON.parse(jsonText) as AppData;
      
      // Simple validation
      if (!parsedData || !Array.isArray(parsedData.goals)) {
        setError('Invalid JSON structure. The JSON must have a "goals" array.');
        return;
      }
      
      console.log("Saving JSON data:", parsedData);
      
      // Save directly to localStorage and GitHub Gist
      const saved = await saveRawJson(jsonText, true);
      
      if (saved) {
        // Update the app state to refresh components
        setData(parsedData);
        console.log("JSON data saved and app state updated");
        
        // Close the modal
        onClose();
      } else {
        setError('Failed to save JSON data');
      }
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
    }
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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
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
        
        <h2 style={{ marginTop: '0', marginBottom: '20px' }}>Edit JSON Data</h2>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
          {error && (
            <div style={{
              padding: '10px',
              backgroundColor: '#ffebee',
              color: '#d32f2f',
              borderRadius: '4px',
              marginBottom: '10px'
            }}>
              {error}
            </div>
          )}
          
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px',
              fontFamily: 'monospace',
              resize: 'none',
              minHeight: '300px'
            }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                backgroundColor: '#f1f1f1',
                marginRight: '10px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#2196f3',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JSONEditorModal;