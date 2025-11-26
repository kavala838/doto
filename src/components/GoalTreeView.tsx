import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { Goal, Child } from '../types';
import { generateSubtasks } from '../services/aiService';
import EditNodeModal from './EditNodeModal';

interface TreeNode {
  id: string;
  title: string;
  description: string;
  children: TreeNode[];
  level: number;
  isCollapsed?: boolean; // Whether this node's children are collapsed
  isMinimized?: boolean; // Whether this node itself is minimized (shown as a small line with icon)
  collapsedChildren?: string[]; // IDs of individually collapsed children
  isHidden?: boolean; // Whether this node is hidden from its parent's view
  done: number; // Whether this node is marked as done (0 = not done, 1 = done)
}

// Define types for SVG elements and paths
type PathElement = React.ReactElement;
type NodeElement = React.ReactElement;
type GraphElement = PathElement | NodeElement;

// New child form interface
interface NewChildForm {
  parentId: string;
  title: string;
  description: string;
  isOpen: boolean;
  parentTitle: string;
}

// New AI form interface
interface AiSubtasksForm {
  parentId: string;
  parentTitle: string;
  parentDescription: string;
  count: number;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

// Add the edit node modal state to the component
interface EditNodeModalState {
  isOpen: boolean;
  nodeId: string;
  title: string;
  description: string;
}

// Define these constants outside of renderGraph so they can be used elsewhere
const nodeSpacing = 500; // Increased from 400 to provide more horizontal space
const levelSpacing = 300; // Increased from 250 to provide more vertical space

const GoalTreeView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, setData } = useAppContext();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [isZooming, setIsZooming] = useState(false); // Track zoom state for debouncing
  const [showCompletedNodes, setShowCompletedNodes] = useState(false); // New state for filter
  const [newChildForm, setNewChildForm] = useState<NewChildForm>({
    parentId: '',
    title: '',
    description: '',
    isOpen: false,
    parentTitle: ''
  });
  const [aiSubtasksForm, setAiSubtasksForm] = useState<AiSubtasksForm>({
    parentId: '',
    parentTitle: '',
    parentDescription: '',
    count: 3,
    isOpen: false,
    isLoading: false,
    error: null
  });
  const [nodePositions, setNodePositions] = useState<Map<string, {x: number, y: number}>>(new Map());
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    nodeId: string;
    nodeTitle: string;
  }>({
    isOpen: false,
    nodeId: '',
    nodeTitle: ''
  });
  // Add toast state
  const [toast, setToast] = useState<{
    message: string;
    isVisible: boolean;
    type: 'error' | 'success';
  }>({
    message: '',
    isVisible: false,
    type: 'error'
  });
  
  // Add state for edit node modal
  const [editNodeModal, setEditNodeModal] = useState<EditNodeModalState>({
    isOpen: false,
    nodeId: '',
    title: '',
    description: ''
  });
  
  // Find the goal by ID
  const goal = data.goals.find(g => g.id === id);
  
  // Pan and zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    // If already zooming, ignore this wheel event
    if (isZooming) return;
    
    // Set zooming state to true
    setIsZooming(true);
    
    // Reduce sensitivity by using a smaller multiplier
    const delta = e.deltaY * -0.001;
    
    // Apply zoom more gradually
    const zoomFactor = 0.05; // Smaller zoom steps
    let newScale;
    
    if (delta < 0) {
      // Zooming out
      newScale = Math.max(0.1, scale - zoomFactor);
    } else {
      // Zooming in
      newScale = Math.min(2, scale + zoomFactor);
    }
    
    // Only update if the change is significant
    if (Math.abs(newScale - scale) >= 0.01) {
      // Get mouse position relative to the container
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate new position to zoom toward mouse
        const newPosition = {
          x: mouseX - ((mouseX - position.x) * newScale / scale),
          y: mouseY - ((mouseY - position.y) * newScale / scale)
        };
        
        setScale(newScale);
        setPosition(newPosition);
      } else {
        setScale(newScale);
      }
    }
    
    // Reset zooming state after a delay
    setTimeout(() => {
      setIsZooming(false);
    }, 150); // 150ms debounce
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.05, 2));
  const zoomOut = () => setScale(s => Math.max(s - 0.05, 0.1));
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Improved function to fit the entire tree to screen
  const fitToScreen = () => {
    if (!containerRef.current || !treeData || nodePositions.size === 0) return;
    
    // Get container dimensions
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // First, find the root node position
    const rootPos = nodePositions.get(treeData.id);
    if (!rootPos) return;
    
    // Initialize the bounding box with the root node position
    let minX = rootPos.x - 150; // Half of node width
    let maxX = rootPos.x + 150; // Half of node width
    let minY = rootPos.y - 100; // Approximate half of node height
    let maxY = rootPos.y + 100; // Approximate half of node height
    
    // Include all immediate children if they exist and are not collapsed
    if (treeData.children.length > 0 && !treeData.isCollapsed) {
      for (const child of treeData.children) {
        if (child.isMinimized) continue;
        
        const childPos = nodePositions.get(child.id);
        if (childPos) {
          // Expand the bounding box to include this child
          minX = Math.min(minX, childPos.x - 150);
          maxX = Math.max(maxX, childPos.x + 150);
          minY = Math.min(minY, childPos.y - 100);
          maxY = Math.max(maxY, childPos.y + 100);
          
          // For larger trees, also include the child's immediate children if they're not collapsed
          if (child.children.length > 0 && !child.isCollapsed) {
            for (const grandchild of child.children) {
              if (grandchild.isMinimized) continue;
              
              const grandchildPos = nodePositions.get(grandchild.id);
              if (grandchildPos) {
                minX = Math.min(minX, grandchildPos.x - 150);
                maxX = Math.max(maxX, grandchildPos.x + 150);
                minY = Math.min(minY, grandchildPos.y - 100);
                maxY = Math.max(maxY, grandchildPos.y + 100);
              }
            }
          }
        }
      }
    }
    
    // Add extra padding to ensure everything is visible
    const paddingX = Math.max(containerRect.width * 0.15, 300);
    const paddingY = Math.max(containerRect.height * 0.15, 200);
    
    minX -= paddingX;
    maxX += paddingX;
    minY -= paddingY;
    maxY += paddingY;
    
    // Calculate dimensions
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Calculate center point
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Calculate scale to fit the entire tree in the viewport
    const scaleX = containerRect.width / width;
    const scaleY = containerRect.height / height;
    
    // Use the smaller scale to ensure everything fits, but don't zoom out too much
    let newScale = Math.min(scaleX, scaleY);
    
    // Ensure scale is within reasonable bounds
    newScale = Math.max(Math.min(newScale, 0.9), 0.4);
    
    // Calculate position to center the tree
    const newPosition = {
      x: containerRect.width / 2 - centerX * newScale,
      y: containerRect.height / 2 - centerY * newScale
    };
    
    // Apply smooth transition with animation
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.8s cubic-bezier(0.19, 1, 0.22, 1)';
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = '';
        }
      }, 800);
    }
    
    // Update position and scale
    setPosition(newPosition);
    setScale(newScale);
    
    console.log("Fit to screen:", { rootPos, bounds: { minX, maxX, minY, maxY }, newScale, newPosition });
  };
  
  // Toggle node collapse state
  const toggleNodeCollapse = (nodeId: string, isChildToggle = false) => {
    if (!treeData) return;
    
    // Helper function to recursively find and update node
    const updateNodeCollapse = (node: TreeNode): TreeNode => {
      // If this is the node we're directly toggling
      if (node.id === nodeId) {
        if (isChildToggle) {
          // When toggling from the line control, we're toggling minimized state of this node
          return { ...node, isMinimized: !node.isMinimized };
        } else {
          // When clicking the node itself, we're toggling its own children's visibility
          return { ...node, isCollapsed: !node.isCollapsed };
        }
      }
      
      // Check if any of this node's children is the target
      const updatedChildren = node.children.map(child => updateNodeCollapse(child));
      
      return {
        ...node,
        children: updatedChildren
      };
    };
    
    setTreeData(updateNodeCollapse(treeData));
  };
  
  // Minimize all children of a node at once
  const minimizeAllChildren = (parentId: string, childrenIds: string[]) => {
    if (!treeData) return;
    
    // Helper function to recursively find the parent and update all its children
    const updateChildrenVisibility = (node: TreeNode): TreeNode => {
      if (node.id === parentId) {
        // This is the parent node, update all its children
        const updatedChildren = node.children.map(child => {
          // If this child is in the list to minimize, set isMinimized to true
          if (childrenIds.includes(child.id)) {
            return { ...child, isMinimized: true };
          }
          return child;
        });
        
        return {
          ...node,
          children: updatedChildren
        };
      }
      
      // If this is not the target parent, check its children
      if (node.children.length > 0) {
        return {
          ...node,
          children: node.children.map(child => updateChildrenVisibility(child))
        };
      }
      
      // Not the parent and no children, return as is
      return node;
    };
    
    setTreeData(updateChildrenVisibility(treeData));
  };
  
  // Open new child form
  const openNewChildForm = (parentId: string, parentTitle: string) => {
    setNewChildForm({
      parentId,
      title: '',
      description: '',
      isOpen: true,
      parentTitle
    });
  };
  
  // Close new child form
  const closeNewChildForm = () => {
    setNewChildForm(prev => ({ ...prev, isOpen: false }));
  };
  
  // Handle form input changes
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewChildForm(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle form submission
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newChildForm.title.trim()) {
      alert('Title is required');
      return;
    }
    
    // Generate a new ID based on current datetime
    const newId = `child_${Date.now()}`;
    
    // Create new child object
    const newChild: Child = {
      id: newId,
      title: newChildForm.title,
      description: newChildForm.description,
      childs: [],
      done: 0
    };
    
    // Update the data by adding the new child to the parent
    const updatedData = { ...data };
    
    // Helper function to recursively find and update the parent goal/child
    const addChildToParent = (items: (Goal | Child)[]): (Goal | Child)[] => {
      return items.map(item => {
        if (item.id === newChildForm.parentId) {
          // Add new child to this parent
          return {
            ...item,
            childs: [...(item.childs || []), newChild]
          };
        }
        
        // If this item has children, search through them
        if (item.childs && item.childs.length > 0) {
          return {
            ...item,
            childs: addChildToParent(item.childs)
          };
        }
        
        return item;
      });
    };
    
    // Update the goals array - fix the type error by casting
    updatedData.goals = addChildToParent(updatedData.goals) as Goal[];
    
    // Save updated data
    setData(updatedData);
    
    // Close the form
    closeNewChildForm();
    
    // Rebuild the tree to show the new child
    if (goal) {
      const buildTree = (node: Goal | Child, level: number): TreeNode => {
        return {
          id: node.id,
          title: node.title,
          description: node.description,
          children: node.childs ? node.childs.map(child => buildTree(child, level + 1)) : [],
          level,
          isCollapsed: false,
          isMinimized: false,
          done: node.done
        };
      };
      
      setTreeData(buildTree(goal, 0));
    }
  };
  
  // Open AI subtasks form
  const openAiSubtasksForm = (parentId: string, parentTitle: string, parentDescription: string) => {
    setAiSubtasksForm({
      parentId,
      parentTitle,
      parentDescription,
      count: 3,
      isOpen: true,
      isLoading: false,
      error: null
    });
  };
  
  // Close AI subtasks form
  const closeAiSubtasksForm = () => {
    setAiSubtasksForm(prev => ({ ...prev, isOpen: false }));
  };
  
  // Handle AI form input changes
  const handleAiFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const count = parseInt(value);
    
    // Ensure count is a positive number
    if (!isNaN(count) && count > 0) {
      setAiSubtasksForm(prev => ({ ...prev, count }));
    }
  };
  
  // Handle AI form submission
  const handleAiFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setAiSubtasksForm(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Call OpenAI API to generate subtasks
      const subtasks = await generateSubtasks(
        aiSubtasksForm.parentDescription, 
        aiSubtasksForm.count
      );
      
      // Update the data by adding the generated subtasks to the parent
      const updatedData = { ...data };
      
      // Helper function to recursively find and update the parent goal/child
      const addSubtasksToParent = (items: (Goal | Child)[]): (Goal | Child)[] => {
        return items.map(item => {
          if (item.id === aiSubtasksForm.parentId) {
            // Add new subtasks to this parent
            return {
              ...item,
              childs: [...(item.childs || []), ...subtasks]
            };
          }
          
          // If this item has children, search through them
          if (item.childs && item.childs.length > 0) {
            return {
              ...item,
              childs: addSubtasksToParent(item.childs)
            };
          }
          
          return item;
        });
      };
      
      // Update the goals array
      updatedData.goals = addSubtasksToParent(updatedData.goals) as Goal[];
      
      // Save updated data
      setData(updatedData);
      
      // Close the form
      closeAiSubtasksForm();
      
      // Rebuild the tree to show the new subtasks
      if (goal) {
        const buildTree = (node: Goal | Child, level: number): TreeNode => {
          return {
            id: node.id,
            title: node.title,
            description: node.description,
            children: node.childs ? node.childs.map(child => buildTree(child, level + 1)) : [],
            level,
            isCollapsed: false,
            isMinimized: false,
            done: node.done
          };
        };
        
        setTreeData(buildTree(goal, 0));
      }
    } catch (error) {
      console.error('Error generating subtasks:', error);
      setAiSubtasksForm(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to generate subtasks. Please try again.' 
      }));
    }
  };
  
  // Calculate the total width needed for the tree
  const calculateTreeDimensions = (node: TreeNode): { width: number, height: number, count: number } => {
    // Base case: if node is collapsed or has no children
    if (node.isCollapsed || node.children.length === 0) {
      return { width: nodeSpacing, height: levelSpacing, count: 1 };
    }
    
    let totalWidth = 0;
    let maxHeight = 0;
    let totalCount = 0;
    
    // Calculate dimensions for all non-minimized children
    const normalChildren = node.children.filter(child => !child.isMinimized);
    
    normalChildren.forEach(child => {
      const { width, height, count } = calculateTreeDimensions(child);
      totalWidth += width;
      maxHeight = Math.max(maxHeight, height);
      totalCount += count;
    });
    
    // Add space for minimized children if any
    const minimizedChildren = node.children.filter(child => child.isMinimized);
    if (minimizedChildren.length > 0) {
      // Each minimized child takes up less space
      const minimizedWidth = minimizedChildren.length * 100; // 100px per minimized child
      totalWidth = Math.max(totalWidth, minimizedWidth);
    }
    
    // Ensure minimum width based on number of normal children
    // This helps maintain consistent spacing even with variable node sizes
    const minWidth = Math.max(normalChildren.length * nodeSpacing, 350); // At least 350px wide
    totalWidth = Math.max(totalWidth, minWidth);
    
    return {
      width: totalWidth,
      height: maxHeight + levelSpacing,
      count: totalCount + 1
    };
  };
  
  // Render the graph
  const renderGraph = (rootNode: TreeNode) => {
    // Create a new positions map
    const newPositions = new Map<string, {x: number, y: number}>();
    
    // Function to recursively position nodes
    const renderNode = (node: TreeNode, x: number, y: number, availableWidth: number): GraphElement[] => {
      // Check if this node is the root node (not used currently)
      // const isRoot = goal && node.id === goal.id;
      
      // Store the node position in our map
      newPositions.set(node.id, { x, y });
      
      // Calculate node height based on content - simplified version of what's in NodeElement
      // This is needed to determine where connector lines should start
      const estimatedNodeHeight = Math.max(
        140,
        (node.title?.length || 0) > 50 ? 160 : 140
      );
      
      // Create node element
      const nodeElement = (
        <NodeElement
          key={`node-${node.id}`}
          node={node} 
          x={x - 160} // Center the node (320/2 = 160), updated from 150
          y={y - 60}  // Adjust for vertical centering
          onAddChild={openNewChildForm}
          onGenerateAI={openAiSubtasksForm}
          onMinimizeAllChildren={minimizeAllChildren}
          onFocus={() => focusOnNode(node.id)}
          isFocused={focusedNodeId === node.id}
          onDelete={openDeleteConfirm}
          onToggleDone={toggleDoneStatus}
          onEdit={openEditNodeModal} // Add the onEdit prop
        />
      );
      
      // If node has no children, just return the node
      if (node.children.length === 0) {
        return [nodeElement];
      }
      
      // If node is collapsed, just return the node without children
      if (node.isCollapsed) {
        return [nodeElement];
      }
      
      // Calculate widths for each child subtree
      const childrenDimensions = node.children.map(child => calculateTreeDimensions(child));
      const totalChildrenWidth = childrenDimensions.reduce((sum, dim) => sum + dim.width, 0);
      
      // Ensure minimum spacing between nodes
      const minTotalWidth = node.children.length * nodeSpacing;
      const effectiveTotalWidth = Math.max(totalChildrenWidth, minTotalWidth);
      
      // Distribute available width proportionally if it's wider than needed
      const scaleFactor = availableWidth > effectiveTotalWidth ? availableWidth / effectiveTotalWidth : 1;
      
      // Position children and create paths
      let currentX = x - (availableWidth / 2);
      const paths: GraphElement[] = [];
      
      // Separate minimized and normal children
      const normalChildren = node.children.filter(child => !child.isMinimized);
      const minimizedChildren = node.children.filter(child => child.isMinimized);
      
      // Calculate connection points distribution
      // For normal children, we'll distribute connection points along the bottom edge
      const nodeWidth = 320; // Updated from 300 to match new node width
      const connectionPointsCount = normalChildren.length;
      const connectionPointSpacing = Math.min(nodeWidth / (connectionPointsCount + 1), 50);
      
      // First render all normal children
      normalChildren.forEach((child, i) => {
        const childIndex = node.children.indexOf(child); // Get the actual index in all children
        const childWidth = childrenDimensions[i].width * scaleFactor;
        const childX = currentX + (childWidth / 2);
        const childY = y + levelSpacing;
        
        // Create paths recursively
        const childPaths = renderNode(
          child, 
          childX, 
          childY, 
          childWidth
        );
        
        // Calculate the end point of the line, just before the child node
        const endX = childX;
        const endY = childY - 60 - 15; // Position 15px above the child node
        
        // Calculate a distributed start point along the bottom edge of the parent node
        // This prevents all lines from starting at the same point
        const startX = x - (nodeWidth / 2) + ((i + 1) * connectionPointSpacing);
        
        // Create path connecting this node to its child
        const path = (
          <path
            key={`path-${node.id}-${child.id}`}
            d={createConnectorPath(startX, y, endX, endY, estimatedNodeHeight)}
            stroke="#2196F3"
            strokeWidth={2}
            fill="none"
            strokeDasharray={child.isCollapsed ? "5,5" : "0"}
            style={{
              filter: 'drop-shadow(0 0 2px rgba(33, 150, 243, 0.2))'
            }}
          />
        );
        
        // Add number indicator at the end of the line
        const numberIndicator = (
          <g 
            key={`number-${node.id}-${child.id}`}
            transform={`translate(${endX}, ${endY})`}
            onClick={(e) => {
              e.stopPropagation();
              // Toggle the child node with isChildToggle=true to indicate this is a line toggle
              toggleNodeCollapse(child.id, true);
            }}
            style={{ cursor: 'pointer' }}
          >
            <title>Child #{childIndex + 1}: {child.title}</title>
            <circle
              r={14}
              fill="#2196F3"
              opacity={0.9}
              style={{
                transition: 'all 0.2s ease',
                filter: 'drop-shadow(0 0 3px rgba(33, 150, 243, 0.3))'
              }}
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fill="white"
              fontSize="14"
              fontWeight="bold"
            >
              {childIndex + 1}
            </text>
          </g>
        );
        
        paths.push(path);
        paths.push(numberIndicator);
        paths.push(...childPaths);
        
        // Move current X position
        currentX += childWidth;
      });
      
      // Then render all minimized children as small lines with icons
      if (minimizedChildren.length > 0) {
        // Calculate spacing between minimized nodes
        const minimizedSpacing = 100; // Increased from 80 for better spacing
        const totalMinimizedWidth = minimizedChildren.length * minimizedSpacing;
        const startX = x - (totalMinimizedWidth / 2) + (minimizedSpacing / 2);
        
        minimizedChildren.forEach((child, i) => {
          const childIndex = node.children.indexOf(child); // Get the actual index in all children
          const childX = startX + (i * minimizedSpacing);
          const childY = y + 150; // Increased from 120 for better vertical separation
          
          // Calculate a distributed start point for minimized nodes
          const minimizedStartX = x - (nodeWidth / 4) + (i * (nodeWidth / 2) / minimizedChildren.length);
          
          // Create a curved line for minimized nodes
          const shortLine = (
            <path
              key={`minimized-line-${node.id}-${child.id}`}
              d={`M ${minimizedStartX} ${y + estimatedNodeHeight/2} Q ${(minimizedStartX + childX) / 2} ${(y + childY) / 2 + 20} ${childX} ${childY - 15}`}
              stroke="#FF9800"
              strokeWidth={2.5}
              fill="none"
              style={{
                filter: 'drop-shadow(0 0 2px rgba(255, 152, 0, 0.2))'
              }}
            />
          );
          
          // Add number indicator at the end of the line
          const numberIndicator = (
            <g 
              key={`minimized-number-${node.id}-${child.id}`}
              transform={`translate(${childX}, ${childY - 15})`}
              onClick={(e) => {
                e.stopPropagation();
                // Expand the minimized node
                toggleNodeCollapse(child.id, true);
              }}
              style={{ cursor: 'pointer' }}
            >
              <title>Child #{childIndex + 1}: {child.title} (click to expand)</title>
              <circle
                r={14}
                fill="#FF9800"
                opacity={0.9}
                style={{
                  transition: 'all 0.2s ease',
                  filter: 'drop-shadow(0 0 3px rgba(255, 152, 0, 0.3))'
                }}
              />
              <text
                x="0"
                y="5"
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontWeight="bold"
              >
                {childIndex + 1}
              </text>
            </g>
          );
          
          paths.push(shortLine);
          paths.push(numberIndicator);
        });
      }
      
      // Add the node itself after all the paths
      paths.push(nodeElement);
      
      return paths;
    };
    
    // Calculate the total width needed for the tree
    const treeWidth = calculateTreeDimensions(rootNode).width;
    
    // Render the tree starting from the center
    const elements = renderNode(rootNode, 0, 100, treeWidth);
    
    return elements;
  };
  
  // Simple function to focus on a node and ensure its children are visible on screen
  const focusOnNode = (nodeId: string) => {
    if (!containerRef.current || !treeData) return;
    
    // Set the focused node ID for highlighting
    setFocusedNodeId(nodeId);
    
    // Get the position of the focused node
    const nodePos = nodePositions.get(nodeId);
    if (!nodePos) {
      console.error(`No position found for node ${nodeId}`);
      return;
    }
    
    // Get container dimensions
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Find the node in the tree to check for children
    const findNode = (node: TreeNode, id: string): TreeNode | null => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };
    
    const targetNode = findNode(treeData, nodeId);
    if (!targetNode) return;
    
    // Fixed zoom level that works well for most cases
    let newScale = 0.85;
    
    // Adjust position to center the node
    const newPosition = {
      x: (containerRect.width / 2) - (nodePos.x * newScale),
      y: (containerRect.height / 3) - (nodePos.y * newScale) // Position node in the upper third
    };
    
    // Apply smooth transition
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.5s ease-out';
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = '';
        }
      }, 500);
    }
    
    // Update position and scale
    setPosition(newPosition);
    setScale(newScale);
    
    console.log(`Focused on node ${nodeId}`);
  };
  
  // Add this useEffect outside of renderGraph to update positions map
  useEffect(() => {
    if (treeData) {
      const positions = new Map<string, {x: number, y: number}>();
      
      // Function to collect positions
      const collectPositions = (node: TreeNode, x: number, y: number, availableWidth: number) => {
        positions.set(node.id, { x, y });
        
        if (node.children.length === 0 || node.isCollapsed) {
          return;
        }
        
        // Calculate widths for each child subtree similar to renderNode
        const childrenDimensions = node.children.map(child => calculateTreeDimensions(child));
        const totalChildrenWidth = childrenDimensions.reduce((sum, dim) => sum + dim.width, 0);
        const minTotalWidth = node.children.length * nodeSpacing;
        const effectiveTotalWidth = Math.max(totalChildrenWidth, minTotalWidth);
        const scaleFactor = availableWidth > effectiveTotalWidth ? availableWidth / effectiveTotalWidth : 1;
        
        // Position children
        let currentX = x - (availableWidth / 2);
        const normalChildren = node.children.filter(child => !child.isMinimized);
        
        normalChildren.forEach((child, i) => {
          const childWidth = childrenDimensions[i].width * scaleFactor;
          const childX = currentX + (childWidth / 2);
          const childY = y + levelSpacing;
          
          collectPositions(child, childX, childY, childWidth);
          
          currentX += childWidth;
        });
      };
      
      // Calculate tree width for the root node
      const rootTreeWidth = calculateTreeDimensions(treeData).width;
      
      // Collect positions
      collectPositions(treeData, 0, 100, rootTreeWidth);
      
      // Update positions map
      setNodePositions(positions);
    }
  }, [treeData]);
  
  // Add this function to filter the tree data based on the showCompletedNodes state
  const filterTreeData = (node: TreeNode): TreeNode => {
    // If showing all nodes, return the node with filtered children
    if (showCompletedNodes) {
      return {
        ...node,
        children: node.children.map(child => filterTreeData(child))
      };
    }
    
    // If hiding completed nodes, filter out children with done=1
    const filteredChildren = node.children
      .filter(child => child.done === 0)
      .map(child => filterTreeData(child));
    
    return {
      ...node,
      children: filteredChildren
    };
  };
  
  // Update the useEffect that builds the tree to apply the filter
  useEffect(() => {
    // Center the view initially
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setPosition({
        x: width / 2 - 150,
        y: height / 4
      });
    }
    
    // Build tree structure when goal changes
    if (goal) {
      console.log("Building tree from goal:", goal);
      const buildTree = (node: Goal | Child, level: number): TreeNode => {
        return {
          id: node.id,
          title: node.title,
          description: node.description,
          children: node.childs ? node.childs.map(child => buildTree(child, level + 1)) : [],
          level,
          isCollapsed: false,
          isMinimized: false,
          done: node.done
        };
      };
      
      // Build the complete tree first
      const completeTree = buildTree(goal, 0);
      
      // Then apply the filter
      setTreeData(filterTreeData(completeTree));
    } else {
      console.log("No goal found with ID:", id);
    }
  }, [goal, id, showCompletedNodes]); // Added showCompletedNodes as a dependency
  
  // Add keyboard navigation
  useEffect(() => {
    // Only add keyboard listeners if we have a focused node
    if (!focusedNodeId || !treeData) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Find the current focused node
      const findNodeById = (node: TreeNode, id: string): TreeNode | null => {
        if (node.id === id) return node;
        for (const child of node.children) {
          const found = findNodeById(child, id);
          if (found) return found;
        }
        return null;
      };
      
      const currentNode = findNodeById(treeData, focusedNodeId);
      if (!currentNode) return;
      
      // Find the parent node
      const findParentNode = (node: TreeNode, childId: string): TreeNode | null => {
        for (const child of node.children) {
          if (child.id === childId) return node;
          const found = findParentNode(child, childId);
          if (found) return found;
        }
        return null;
      };
      
      const parentNode = findParentNode(treeData, focusedNodeId);
      
      // Helper function to focus on a node with a delay to ensure proper position calculation
      const focusWithDelay = (nodeId: string, customDelay = 50) => {
        // First just set the focusedNodeId to update UI indication immediately
        setFocusedNodeId(nodeId);
        
        // Then wait a moment before actually centering the view on the node
        // This ensures that the nodePositions map is updated with the latest positions
        setTimeout(() => {
          // Force re-collection of node positions for more accurate focusing
          if (treeData) {
            const positions = new Map<string, {x: number, y: number}>();
            
            // Function to collect positions (simplified version to run quickly)
            const collectPositions = (node: TreeNode, x: number, y: number) => {
              positions.set(node.id, { x, y });
              
              if (node.children.length === 0 || node.isCollapsed) return;
              
              // Use existing nodePositions for children if available
              node.children.forEach(child => {
                const existingPos = nodePositions.get(child.id);
                if (existingPos) {
                  positions.set(child.id, existingPos);
                  collectPositions(child, existingPos.x, existingPos.y);
                }
              });
            };
            
            // Use existing root position
            const rootPos = nodePositions.get(treeData.id);
            if (rootPos) {
              collectPositions(treeData, rootPos.x, rootPos.y);
              setNodePositions(positions);
            }
          }
          
          // Then focus on the node
          focusOnNode(nodeId);
        }, customDelay);
      };
      
      // Navigate based on key press
      switch (e.key) {
        case 'ArrowDown':
          // Move to first child if available and not collapsed
          if (currentNode.children.length > 0 && !currentNode.isCollapsed) {
            const firstVisibleChild = currentNode.children.find(child => !child.isMinimized);
            if (firstVisibleChild) {
              e.preventDefault();
              focusWithDelay(firstVisibleChild.id);
            }
          }
          break;
          
        case 'ArrowUp':
          // Move to parent if available
          if (parentNode) {
            e.preventDefault();
            focusWithDelay(parentNode.id);
          }
          break;
          
        case 'ArrowRight':
          // Move to next sibling if available
          if (parentNode) {
            const siblings = parentNode.children;
            const currentIndex = siblings.findIndex(child => child.id === focusedNodeId);
            if (currentIndex < siblings.length - 1) {
              e.preventDefault();
              // Use a longer delay for sibling navigation to ensure positions are updated
              focusWithDelay(siblings[currentIndex + 1].id, 100);
            }
          }
          break;
          
        case 'ArrowLeft':
          // Move to previous sibling if available
          if (parentNode) {
            const siblings = parentNode.children;
            const currentIndex = siblings.findIndex(child => child.id === focusedNodeId);
            if (currentIndex > 0) {
              e.preventDefault();
              // Use a longer delay for sibling navigation to ensure positions are updated
              focusWithDelay(siblings[currentIndex - 1].id, 100);
            }
          }
          break;
          
        case 'Space':
          // Toggle node collapse
          e.preventDefault();
          toggleNodeCollapse(focusedNodeId);
          break;
      }
    };
    
    // Add event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedNodeId, treeData, nodePositions, toggleNodeCollapse]);
  
  // Add delete node function
  const handleDeleteNode = (nodeId: string) => {
    // Find the parent node ID of the node to be deleted
    let parentNodeId: string | null = null;
    
    // Helper function to find the parent node
    const findParentNodeId = (items: (Goal | Child)[], currentPath: string[] = []): string | null => {
      for (const item of items) {
        if (item.id === nodeId) {
          // If we found the node to delete and there's a parent in the path
          return currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
        }
        
        // Check children recursively
        if ('childs' in item && item.childs && item.childs.length > 0) {
          const foundInChildren = findParentNodeId(item.childs, [...currentPath, item.id]);
          if (foundInChildren) {
            return foundInChildren;
          }
        }
      }
      return null;
    };
    
    // Find the parent before deletion
    if (goal) {
      if (goal.id === nodeId) {
        // If deleting the root node, there's no parent
        parentNodeId = null;
      } else if (goal.childs && goal.childs.length > 0) {
        // Look for parent in the children hierarchy
        parentNodeId = findParentNodeId(goal.childs, [goal.id]);
      }
    }
    
    // Find the node to delete
    const deleteNodeFromTree = (items: (Goal | Child)[]): (Goal | Child)[] => {
      return items.filter(item => {
        // Keep all items that don't match the ID
        if (item.id === nodeId) {
          return false;
        }
        
        // If this item has children, filter its children recursively
        if ('childs' in item && item.childs && item.childs.length > 0) {
          item.childs = deleteNodeFromTree(item.childs);
        }
        
        return true;
      });
    };
    
    // Create a new copy of the data with the node removed
    const newData = {
      ...data,
      goals: data.goals.map(g => {
        if (g.id === id) {
          // If this is the current goal being viewed
          if (g.id === nodeId) {
            // If trying to delete the root goal, navigate back to home
            navigate('/');
            return g;
          }
          
          // Otherwise, filter out the node from its children
          if (g.childs && g.childs.length > 0) {
            return {
              ...g,
              childs: deleteNodeFromTree(g.childs)
            };
          }
        }
        return g;
      })
    };
    
    // Update the data
    setData(newData);
    
    // Close the confirmation dialog
    setDeleteConfirm({
      isOpen: false,
      nodeId: '',
      nodeTitle: ''
    });
    
    // If the deleted node was the focused node, clear focus
    if (focusedNodeId === nodeId) {
      setFocusedNodeId(null);
    }
    
    // Find the updated goal and rebuild the tree data to reflect the deletion
    const updatedGoal = newData.goals.find(g => g.id === id);
    if (updatedGoal) {
      // Build tree function to convert the updated data into tree structure
      const buildTree = (node: Goal | Child, level: number): TreeNode => {
        return {
          id: node.id,
          title: node.title,
          description: node.description || "",
          level,
          children: node.childs ? node.childs.map(child => buildTree(child, level + 1)) : [],
          isCollapsed: false,
          done: node.done
        };
      };
      
      // Update the tree data with the new structure
      setTreeData(buildTree(updatedGoal, 0));
      
      // Focus on the parent node instead of going back to root
      if (parentNodeId) {
        setTimeout(() => {
          focusOnNode(parentNodeId);
        }, 100); // Small timeout to ensure the tree has been rendered
      }
    }
  };
  
  // Add openDeleteConfirm function
  const openDeleteConfirm = (nodeId: string, nodeTitle: string) => {
    setDeleteConfirm({
      isOpen: true,
      nodeId,
      nodeTitle
    });
  };
  
  // Add closeDeleteConfirm function
  const closeDeleteConfirm = () => {
    setDeleteConfirm({
      isOpen: false,
      nodeId: '',
      nodeTitle: ''
    });
  };
  
  // Function to show toast message
  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({
      message,
      isVisible: true,
      type
    });
    
    // Auto-hide after 1.5 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, isVisible: false }));
    }, 1500);
  };
  
  // Modify the toggleDoneStatus function to check children status
  const toggleDoneStatus = (nodeId: string) => {
    if (!treeData) return;
    
    // Helper function to check if all children of a node are done
    const areAllChildrenDone = (node: TreeNode): boolean => {
      if (node.children.length === 0) return true;
      return node.children.every(child => child.done === 1 && areAllChildrenDone(child));
    };
    
    // Find the node to toggle
    const findNode = (node: TreeNode, id: string): TreeNode | null => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };
    
    const nodeToToggle = findNode(treeData, nodeId);
    
    // If node not found, return
    if (!nodeToToggle) return;
    
    // If trying to mark as done, check if all children are done
    if (nodeToToggle.done === 0) {
      // If node has children and not all are done, show error
      if (nodeToToggle.children.length > 0 && !areAllChildrenDone(nodeToToggle)) {
        showToast("Cannot mark as done: Complete all subtasks first", "error");
        return;
      }
    }
    
    // Create a new copy of the data
    const updatedData = { ...data };
    
    // Helper function to recursively find and update node's done status
    const updateNodeDoneStatus = (items: (Goal | Child)[]): (Goal | Child)[] => {
      return items.map(item => {
        if (item.id === nodeId) {
          // Toggle done status (0 -> 1, 1 -> 0)
          return {
            ...item,
            done: item.done === 0 ? 1 : 0
          };
        }
        
        // If this item has children, search through them
        if (item.childs && item.childs.length > 0) {
          return {
            ...item,
            childs: updateNodeDoneStatus(item.childs)
          };
        }
        
        return item;
      });
    };
    
    // Update the goals array
    updatedData.goals = updateNodeDoneStatus(updatedData.goals) as Goal[];
    
    // Save updated data
    setData(updatedData);
    
    // Update the tree data to reflect the change
    if (goal) {
      const buildTree = (node: Goal | Child, level: number): TreeNode => {
        return {
          id: node.id,
          title: node.title,
          description: node.description,
          children: node.childs ? node.childs.map(child => buildTree(child, level + 1)) : [],
          level,
          isCollapsed: false,
          isMinimized: false,
          done: node.done
        };
      };
      
      // Build the complete tree first
      const completeTree = buildTree(goal, 0);
      
      // Then apply the filter
      setTreeData(filterTreeData(completeTree));
    }
  };
  
  // Add a function to open the edit node modal
  const openEditNodeModal = (nodeId: string, title: string, description: string) => {
    setEditNodeModal({
      isOpen: true,
      nodeId,
      title,
      description
    });
  };
  
  // Add a function to close the edit node modal
  const closeEditNodeModal = () => {
    setEditNodeModal({
      isOpen: false,
      nodeId: '',
      title: '',
      description: ''
    });
  };
  
  // Add a function to save the edited node
  const handleSaveEditedNode = (nodeId: string, title: string, description: string) => {
    // Update the node in the tree
    const updatedGoals = updateNodeContent(data.goals, nodeId, title, description) as Goal[];
    
    // Update the app context data
    setData({
      ...data,
      goals: updatedGoals
    });
    
    // Rebuild the tree data
    if (goal) {
      // Use the same buildTree function that's used elsewhere in the component
      const buildTreeWithLevel = (node: Goal | Child, level: number): TreeNode => {
        return {
          id: node.id,
          title: node.title,
          description: node.description || '',
          children: ('childs' in node && node.childs) 
            ? node.childs.map(child => buildTreeWithLevel(child, level + 1))
            : [],
          level,
          isCollapsed: false,
          done: node.done || 0
        };
      };
      
      const newTreeData = buildTreeWithLevel(goal, 0);
      setTreeData(newTreeData);
      
      // Show success toast
      showToast(`Node "${title}" updated successfully`, 'success');
    }
    
    // Close the modal
    closeEditNodeModal();
  };
  
  // Add a function to update the node content
  const updateNodeContent = (items: (Goal | Child)[], nodeId: string, title: string, description: string): (Goal | Child)[] => {
    return items.map(item => {
      if (item.id === nodeId) {
        // Update this item
        return {
          ...item,
          title,
          description
        };
      } else if ('childs' in item && item.childs.length > 0) {
        // Recursively update children
        return {
          ...item,
          childs: updateNodeContent(item.childs, nodeId, title, description)
        };
      }
      return item;
    });
  };
  
  if (!goal || !treeData) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
        backgroundColor: '#F5F7FA',
        color: '#334155'
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '30px 40px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
          textAlign: 'center',
          maxWidth: '400px',
          width: '90%'
        }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '20px',
            color: '#94A3B8'
          }}>
            🔍
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '10px',
            color: '#1E293B'
          }}>Goal Not Found</h2>
          <p style={{
            fontSize: '16px',
            color: '#64748B',
            marginBottom: '25px'
          }}>
            We couldn't find the goal you're looking for. It may have been deleted or the URL might be incorrect.
          </p>
          <button 
            onClick={() => navigate('/')}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2196F3',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '15px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1E88E5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2196F3';
            }}
          >
            Back to Goals
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative',
        width: '100%', 
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#F8FAFC',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Toast notification */}
      {toast.isVisible && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: toast.type === 'error' ? '#FEE2E2' : '#ECFDF5',
            color: toast.type === 'error' ? '#EF4444' : '#10B981',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '90%',
            border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#A7F3D0'}`
          }}
        >
          {toast.type === 'error' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          )}
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}
      
      {/* Grid background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 0, 0, 0.05) 1.5px, transparent 1.5px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1.5px, transparent 1.5px),
          linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
        backgroundPosition: `-1.5px -1.5px, -1.5px -1.5px, -1px -1px, -1px -1px`,
        zIndex: 0
      }} />
      
      {/* Back button */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 10
      }}>
        <button 
          onClick={() => navigate('/')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F8F9FA';
            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <span style={{ marginRight: '8px' }}>←</span> Back
        </button>
      </div>

      {/* Title - repositioned to top right */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Semi-transparent background
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '8px 15px',
        borderRadius: '8px',
        maxWidth: '40%', // Limit width to avoid taking too much space
        backdropFilter: 'blur(5px)', // Add a subtle blur effect for better readability
      }}>
        <h3 style={{ 
          margin: '0', 
          textAlign: 'center', 
          fontSize: '14px', 
          color: '#333',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {goal.title}
        </h3>
      </div>
      
      {/* Zoom controls */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 100
      }}>
        <button
          onClick={zoomIn}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F8F9FA';
            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          +
        </button>
        <button
          onClick={zoomOut}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F8F9FA';
            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          -
        </button>
        <button
          onClick={resetView}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F8F9FA';
            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          ↺
        </button>
        <button
          onClick={fitToScreen}
          title="Fit entire tree to screen"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F8F9FA';
            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <span style={{ 
            display: 'inline-block', 
            border: '2px solid currentColor', 
            borderRadius: '2px', 
            width: '18px', 
            height: '12px'
          }}></span>
        </button>
      </div>
      
      {/* Keyboard shortcuts hint */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '10px 15px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        fontSize: '13px',
        color: '#475569',
        zIndex: 100,
        display: focusedNodeId ? 'block' : 'none',
        maxWidth: '250px'
      }}>
        <div style={{ fontWeight: 600, marginBottom: '5px' }}>Keyboard Navigation</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>↑</span>
          <span>Parent node</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>↓</span>
          <span>Child node</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>←/→</span>
          <span>Sibling nodes</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Space</span>
          <span>Toggle collapse</span>
        </div>
      </div>
      
      {/* Tree container */}
      <div 
        ref={containerRef}
        style={{
          position: 'absolute',
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.8s ease, scale 0.8s ease',
        }}>
        {treeData && (
          <svg
            width={2000} // Increased width to accommodate larger tree
            height={2000} // Increased height to accommodate larger tree
            style={{ overflow: 'visible' }}
          >
            <g>{renderGraph(treeData)}</g>
          </svg>
        )}
      </div>
      
      {/* New Child Form Modal */}
      {newChildForm.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(5px)'
        }} onClick={closeNewChildForm}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
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
              Add Child Goal to "{newChildForm.parentTitle}"
            </h3>
            
            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: '#64748B',
                  fontSize: '14px'
                }}>
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={newChildForm.title}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    color: '#334155',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter goal title"
                  required
                  autoFocus
                />
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: '#64748B',
                  fontSize: '14px'
                }}>
                  Description
                </label>
                <textarea
                  name="description"
                  value={newChildForm.description}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    color: '#334155',
                    fontSize: '16px',
                    minHeight: '100px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                  placeholder="Enter goal description"
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                <button
                  type="button"
                  onClick={closeNewChildForm}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1E88E5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2196F3';
                  }}
                >
                  Add Child Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* AI Subtasks Form Modal */}
      {aiSubtasksForm.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(5px)'
        }} onClick={closeAiSubtasksForm}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
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
              Generate AI Subtasks for "{aiSubtasksForm.parentTitle}"
            </h3>
            
            <form onSubmit={handleAiFormSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: '#64748B',
                  fontSize: '14px'
                }}>
                  How many subtasks do you want to generate?
                </label>
                <input
                  type="number"
                  min="1"
                  value={aiSubtasksForm.count}
                  onChange={handleAiFormChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    color: '#334155',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter number of subtasks"
                  required
                  autoFocus
                />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: '#64748B',
                  fontSize: '14px'
                }}>
                  Description to analyze:
                </label>
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  color: '#334155',
                  fontSize: '14px',
                  minHeight: '80px',
                  maxHeight: '150px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {aiSubtasksForm.parentDescription || "No description provided"}
                </div>
              </div>
              
              {aiSubtasksForm.error && (
                <div style={{
                  padding: '12px',
                  marginBottom: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#EF4444',
                  borderRadius: '8px',
                  fontSize: '14px',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                  {aiSubtasksForm.error}
                </div>
              )}
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                <button
                  type="button"
                  onClick={closeAiSubtasksForm}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease'
                  }}
                  disabled={aiSubtasksForm.isLoading}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#673AB7',
                    color: '#fff',
                    cursor: aiSubtasksForm.isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  disabled={aiSubtasksForm.isLoading}
                  onMouseEnter={(e) => {
                    if (!aiSubtasksForm.isLoading) {
                      e.currentTarget.style.backgroundColor = '#5E35B1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#673AB7';
                  }}
                >
                  {aiSubtasksForm.isLoading ? (
                    <>
                      <span className="loading-spinner" style={{
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderRadius: '50%',
                        borderTopColor: '#fff',
                        animation: 'spin 1s ease-in-out infinite'
                      }}></span>
                      <style>{`
                        @keyframes spin {
                          to { transform: rotate(360deg); }
                        }
                      `}</style>
                      Generating...
                    </>
                  ) : (
                    <>Generate Subtasks</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
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
        }} onClick={closeDeleteConfirm}>
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
              Delete "{deleteConfirm.nodeTitle}"?
            </h3>
            
            <p style={{
              margin: '0 0 24px 0',
              color: '#64748B',
              fontSize: '14px',
              textAlign: 'center',
              lineHeight: '1.5'
            }}>
              This will permanently delete this node and all its children. This action cannot be undone.
            </p>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              gap: '16px'
            }}>
              <button
                onClick={closeDeleteConfirm}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNode(deleteConfirm.nodeId)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#F44336',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E53935';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F44336';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Filter toggle button */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '80px', // Positioned to the left of zoom controls
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '8px 12px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        gap: '10px'
      }}>
        <label 
          htmlFor="show-completed"
          style={{ 
            fontSize: '14px',
            color: '#475569',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <div style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            border: `2px solid ${showCompletedNodes ? '#4CAF50' : '#9E9E9E'}`,
            backgroundColor: showCompletedNodes ? '#E8F5E9' : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}>
            {showCompletedNodes && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </div>
          Show completed tasks
        </label>
        <input 
          id="show-completed"
          type="checkbox"
          checked={showCompletedNodes}
          onChange={() => setShowCompletedNodes(!showCompletedNodes)}
          style={{ display: 'none' }}
        />
      </div>
      
      {/* Add the EditNodeModal */}
      {editNodeModal.isOpen && (
        <EditNodeModal
          nodeId={editNodeModal.nodeId}
          title={editNodeModal.title}
          description={editNodeModal.description}
          onSave={handleSaveEditedNode}
          onClose={closeEditNodeModal}
        />
      )}
    </div>
  );
};

// Helper to calculate connector paths
const createConnectorPath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  nodeHeight: number = 0
) => {
  // Calculate horizontal and vertical distances
  // const dx = endX - startX; // Not used currently
  const dy = endY - startY;
  
  // Adjust the start point based on the node's height
  // This ensures the line starts from the bottom edge of the node
  const adjustedStartY = startY + (nodeHeight / 2);
  
  // Adjust control points based on distance
  const offsetY = Math.abs(dy) * 0.5; // 50% of vertical distance
  
  // Create a more pronounced S-curve for better visual separation
  // that ends exactly at the end point
  return `M ${startX} ${adjustedStartY} 
          C ${startX} ${adjustedStartY + offsetY}, 
            ${endX} ${endY - offsetY}, 
            ${endX} ${endY}`;
};

interface NodeElementProps {
  node: TreeNode;
  x: number;
  y: number;
  onAddChild: (parentId: string, parentTitle: string) => void;
  onGenerateAI: (parentId: string, parentTitle: string, parentDescription: string) => void;
  onMinimizeAllChildren: (parentId: string, childrenIds: string[]) => void;
  onFocus: () => void;
  isFocused: boolean;
  onDelete: (nodeId: string, nodeTitle: string) => void;
  onToggleDone: (nodeId: string) => void;
  onEdit: (nodeId: string, title: string, description: string) => void; // New prop for editing
}

const NodeElement: React.FC<NodeElementProps> = ({ 
  node, 
  x, 
  y, 
  onAddChild, 
  onGenerateAI, 
  onMinimizeAllChildren,
  onFocus,
  isFocused,
  onDelete,
  onToggleDone,
  onEdit // New prop
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [titleHeight, setTitleHeight] = useState(0);
  const [descriptionHeight, setDescriptionHeight] = useState(0);
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const titleRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Measure title and description height on mount and when content changes
  useEffect(() => {
    if (titleRef.current) {
      setTitleHeight(titleRef.current.scrollHeight);
    }
  }, [node.title]);
  
  useEffect(() => {
    if (showDetails && descriptionRef.current && node.description) {
      setDescriptionHeight(descriptionRef.current.scrollHeight);
    } else {
      setDescriptionHeight(0);
    }
  }, [showDetails, node.description]);
  
  useEffect(() => {
    if (actionBarRef.current) {
      setActionBarHeight(actionBarRef.current.scrollHeight);
    }
  }, []);
  
  // Calculate title height with buffer for long titles
  const calculatedTitleHeight = Math.min(Math.max(titleHeight, 30), 120);
  
  // Calculate node height based on content with guaranteed space for action buttons
  // More accurate calculation that accounts for all elements
  const nodeHeight = Math.max(
    180, // Increased minimum height to 180px to ensure buttons have space
    calculatedTitleHeight + 
    (node.children.length > 0 ? 20 : 0) + // Extra space for nodes with children
    20 + // Divider height + margins (increased)
    (showDetails && node.description ? Math.min(descriptionHeight, 120) + 20 : 0) + 
    Math.max(actionBarHeight + 30, 70) + // Guarantee at least 70px for action buttons
    32 // Padding (top and bottom)
  );
  
  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddChild(node.id, node.title);
  };
  
  const handleGenerateAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGenerateAI(node.id, node.title, node.description);
  };
  
  const handleToggleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetails(!showDetails);
  };
  
  const handleCollapseAllChildren = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Get all direct children of this node that aren't already minimized
    const childrenToMinimize = node.children
      .filter(child => !child.isMinimized)
      .map(child => child.id);
    
    // If we have children to minimize, call a new function to minimize them all at once
    if (childrenToMinimize.length > 0) {
      onMinimizeAllChildren(node.id, childrenToMinimize);
    }
  };
  
  // Truncate title if it's too long
  // Commented out as it's not currently used
  // const truncateText = (text: string, maxLength: number) => {
  //   if (text.length <= maxLength) return text;
  //   return text.substring(0, maxLength) + '...';
  // };
  
  const displayTitle = node.title || 'Untitled';
  
  // Handle node click to focus
  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocus();
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.id, node.title);
  };
  
  const handleToggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleDone(node.id);
  };
  
  // Add a handler for the edit button
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(node.id, node.title, node.description);
  };
  
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleNodeClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Node background - fixed width and dynamic height */}
      <rect
        x="0"
        y="0"
        width="320" // Increased from 300 to provide more space for icons
        height={nodeHeight}
        rx="14"
        ry="14"
        fill={isHovered ? "#F8FAFC" : "#FFFFFF"}
        stroke={isFocused ? "#FF6B00" : isHovered ? "#3B82F6" : "#E2E8F0"}
        strokeWidth={isFocused ? "3" : "2"}
        style={{
          transition: 'all 0.2s ease',
          filter: isFocused 
            ? 'drop-shadow(0 0 10px rgba(255, 107, 0, 0.4))' 
            : isHovered 
              ? 'drop-shadow(0 6px 16px rgba(59, 130, 246, 0.25))' 
              : 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.08))'
        }}
      >
        <title>Click to center this node in view</title>
      </rect>
      
      {/* Optional: Add a focus indicator */}
      {isFocused && (
        <rect
          x="-5"
          y="-5"
          width="330" // Increased from 310 to match the increased node width
          height={nodeHeight + 10}
          rx="18"
          ry="18"
          fill="none"
          stroke="#FF6B00"
          strokeWidth="2"
          strokeDasharray="5,5"
          opacity="0.7"
        />
      )}
      
      {/* Node content - fixed width and dynamic height */}
      <foreignObject x="0" y="0" width="320" height={nodeHeight}> {/* Increased from 300 to match the rect width */}
        <div style={{
          padding: '16px',
          paddingTop: '16px',
          fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
          color: '#334155',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Top content section */}
          <div style={{ flex: '1 1 auto' }}>
            {/* Title section with collapse all children button positioned absolutely */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              {/* Collapse all children button (if has children) - positioned to the left of title */}
              {node.children.length > 0 && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isHovered ? '#FFF3E0' : '#FFFFFF',
                    border: '1px solid #FF9800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    color: '#FF9800',
                    zIndex: 2
                  }}
                  onClick={handleCollapseAllChildren}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFF3E0';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isHovered ? '#FFF3E0' : '#FFFFFF';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="Collapse all children"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="18" x2="3" y2="18"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="12" x2="3" y2="12"></line>
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="6" x2="3" y2="6"></line>
                  </svg>
                </div>
              )}
              
              {/* Title text */}
              <div 
                ref={titleRef}
                style={{ 
                  fontWeight: 600, 
                  fontSize: '18px', 
                  textAlign: 'center',
                  marginTop: '4px',
                  marginBottom: '8px',
                  paddingLeft: node.children.length > 0 ? '12px' : '16px',
                  paddingRight: node.children.length > 0 ? '44px' : '16px', // Extra padding when collapse button is present
                  wordWrap: 'break-word',
                  whiteSpace: 'normal',
                  lineHeight: '1.5',
                  color: '#1E293B',
                  maxHeight: '120px', // Increased from 90px to allow more title content
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 4, // Increased from 3 to 4 lines
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {displayTitle}
              </div>
            </div>
            
            {/* Divider line */}
            <div style={{
              height: '1px',
              backgroundColor: '#E2E8F0',
              margin: '12px 8px',
            }} />
            
            {/* Description (if showDetails is true) */}
            {showDetails && node.description && (
              <div 
                ref={descriptionRef}
                style={{
                  fontSize: '15px',
                  color: '#64748B',
                  padding: '0 12px',
                  marginBottom: '12px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  textAlign: 'left',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}
              >
                {node.description}
              </div>
            )}
          </div>
          
          {/* Action buttons row - always at the bottom, aligned to the right, with guaranteed space */}
          <div 
            ref={actionBarRef}
            style={{
              display: 'flex',
              justifyContent: 'space-between', // Changed from flex-end to space-between
              padding: '0 12px', // Adjusted padding
              marginBottom: '8px',
              marginTop: '12px',
              minHeight: '40px', // Ensure minimum height for action bar
              flex: '0 0 auto', // Don't allow this to shrink
              width: '100%', // Ensure full width
              boxSizing: 'border-box' // Include padding in width calculation
            }}
          >
            {/* Left side - done checkbox */}
            <div>
              <div 
                style={{
                  width: '32px', // Slightly reduced size
                  height: '32px', // Slightly reduced size
                  borderRadius: '50%',
                  backgroundColor: isHovered ? (node.done === 1 ? '#E8F5E9' : '#F5F5F5') : '#FFFFFF',
                  border: `1px solid ${node.done === 1 ? '#4CAF50' : '#9E9E9E'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: node.done === 1 ? '#4CAF50' : '#9E9E9E'
                }}
                onClick={handleToggleDone}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = node.done === 1 ? '#E8F5E9' : '#F5F5F5';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isHovered ? (node.done === 1 ? '#E8F5E9' : '#F5F5F5') : '#FFFFFF';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={node.done === 1 ? "Mark as not done" : "Mark as done"}
              >
                {node.done === 1 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  </svg>
                )}
              </div>
            </div>
            
            {/* Right side - action buttons */}
            <div style={{
              display: 'flex',
              gap: '10px', // Slightly increased gap for better spacing
              flexWrap: 'nowrap', // Prevent wrapping
              overflow: 'visible', // Allow overflow to be visible
              justifyContent: 'flex-end', // Align to the right
              width: 'auto', // Auto width
              maxWidth: '220px' // Limit maximum width to prevent overflow
            }}>
              {/* View details button */}
              <div 
                style={{
                  width: '32px', // Slightly reduced size
                  height: '32px', // Slightly reduced size
                  borderRadius: '50%',
                  backgroundColor: isHovered ? '#E8F5E9' : '#FFFFFF',
                  border: '1px solid #4CAF50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: '#4CAF50'
                }}
                onClick={handleToggleDetails}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E8F5E9';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isHovered ? '#E8F5E9' : '#FFFFFF';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={showDetails ? "Hide details" : "View details"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </div>
              
              {/* AI Generate Button */}
              <div 
                style={{
                  width: '32px', // Slightly reduced size
                  height: '32px', // Slightly reduced size
                  borderRadius: '50%',
                  backgroundColor: isHovered ? '#EDE7F6' : '#FFFFFF',
                  border: '1px solid #673AB7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: '#673AB7'
                }}
                onClick={handleGenerateAI}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#EDE7F6';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isHovered ? '#EDE7F6' : '#FFFFFF';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Generate AI subtasks"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 0 0-9.95 9h11.64L9.74 7.05a1 1 0 0 1 1.41-1.41l5.66 5.65a1 1 0 0 1 0 1.42l-5.66 5.65a1 1 0 0 1-1.41-1.41L13.69 13H2.05A10 10 0 1 0 12 2z"></path>
                </svg>
              </div>
              
              {/* Add Child Button */}
              <div 
                style={{
                  width: '32px', // Slightly reduced size
                  height: '32px', // Slightly reduced size
                  borderRadius: '50%',
                  backgroundColor: isHovered ? '#E3F2FD' : '#FFFFFF',
                  border: '1px solid #2196F3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: '#2196F3'
                }}
                onClick={handleAddChild}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E3F2FD';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isHovered ? '#E3F2FD' : '#FFFFFF';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Add child"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              
              {/* Delete Button */}
              <div 
                style={{
                  width: '32px', // Slightly reduced size
                  height: '32px', // Slightly reduced size
                  borderRadius: '50%',
                  backgroundColor: isHovered ? '#FFEBEE' : '#FFFFFF',
                  border: '1px solid #F44336',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: '#F44336'
                }}
                onClick={handleDelete}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFEBEE';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isHovered ? '#FFEBEE' : '#FFFFFF';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Delete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </div>
              
              {/* Edit Button */}
              <div 
                style={{
                  width: '32px', // Slightly reduced size
                  height: '32px', // Slightly reduced size
                  borderRadius: '50%',
                  backgroundColor: isHovered ? '#E1F5FE' : '#FFFFFF',
                  border: '1px solid #03A9F4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: '#03A9F4'
                }}
                onClick={handleEdit}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E1F5FE';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isHovered ? '#E1F5FE' : '#FFFFFF';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Edit"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

export default GoalTreeView; 