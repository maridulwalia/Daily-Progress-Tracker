import React, { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { Plus, X, Calendar, TrendingUp, Award, Target, Edit2, Save, AlertCircle, ChevronDown, ChevronUp, Star } from 'lucide-react';

// IndexedDB utilities
const DB_NAME = 'ProgressTrackerDB';
const DB_VERSION = 1;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('priority', 'priority', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('completions')) {
        db.createObjectStore('completions', { keyPath: 'id' });
      }
    };
  });
};

const saveToIndexedDB = async (storeName, data) => {
  const db = await initDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  if (Array.isArray(data)) {
    for (const item of data) {
      await store.put(item);
    }
  } else {
    await store.put(data);
  }
  
  return transaction.complete;
};

const loadFromIndexedDB = async (storeName) => {
  const db = await initDB();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100
    }
  }
};

const DailyProgressTracker = () => {
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [dailyCompletion, setDailyCompletion] = useState({});
  const [totalDays, setTotalDays] = useState(7);
  const [editingTask, setEditingTask] = useState(null);
  const [viewMode, setViewMode] = useState('daily'); // daily, weekly, monthly
  const [showSummaries, setShowSummaries] = useState(false);
  
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  const priorityColors = {
    high: '#FF4757',
    medium: '#FFA502',
    low: '#2ED573'
  };

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedTasks, loadedCompletions] = await Promise.all([
          loadFromIndexedDB('tasks'),
          loadFromIndexedDB('completions')
        ]);
        
        if (loadedTasks.length > 0) {
          setTasks(loadedTasks.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }));
        }
        
        if (loadedCompletions.length > 0) {
          const completionMap = {};
          loadedCompletions.forEach(completion => {
            completionMap[completion.id] = completion.data;
          });
          setDailyCompletion(completionMap);
        }
      } catch (error) {
        console.error('Failed to load data from IndexedDB:', error);
      }
    };
    
    loadData();
  }, []);

  // Save data to IndexedDB when tasks or completions change
  useEffect(() => {
    if (tasks.length > 0) {
      saveToIndexedDB('tasks', tasks);
    }
  }, [tasks]);

  useEffect(() => {
    const completionEntries = Object.entries(dailyCompletion).map(([date, data]) => ({
      id: date,
      data: data
    }));
    if (completionEntries.length > 0) {
      saveToIndexedDB('completions', completionEntries);
    }
  }, [dailyCompletion]);

  const addTask = () => {
    if (newTaskName.trim()) {
      const newTask = {
        id: Date.now(),
        name: newTaskName.trim(),
        color: colors[tasks.length % colors.length],
        priority: newTaskPriority,
        completedDays: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      };
      
      const updatedTasks = [...tasks, newTask].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      setTasks(updatedTasks);
      setNewTaskName('');
      setNewTaskPriority('medium');
    }
  };

  const updateTask = (taskId, updates) => {
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ).sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    setTasks(updatedTasks);
    setEditingTask(null);
  };

  const removeTask = (taskId) => {
    setTasks(tasks.filter(task => task.id !== taskId));
    const newDailyCompletion = { ...dailyCompletion };
    Object.keys(newDailyCompletion).forEach(date => {
      delete newDailyCompletion[date][taskId];
    });
    setDailyCompletion(newDailyCompletion);
  };

  const toggleTaskCompletion = (taskId, date = getTodayDate()) => {
    const newDailyCompletion = { ...dailyCompletion };
    if (!newDailyCompletion[date]) {
      newDailyCompletion[date] = {};
    }
    newDailyCompletion[date][taskId] = !newDailyCompletion[date][taskId];
    setDailyCompletion(newDailyCompletion);
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getTaskCompletionRate = (taskId) => {
    let completedCount = 0;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - totalDays + 1);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (dailyCompletion[dateStr] && dailyCompletion[dateStr][taskId]) {
        completedCount++;
      }
    }
    
    return Math.round((completedCount / totalDays) * 100);
  };

  const getStreak = (taskId) => {
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (dailyCompletion[dateStr] && dailyCompletion[dateStr][taskId]) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const getRadarData = () => {
    return tasks.map(task => ({
      task: task.name,
      completion: getTaskCompletionRate(task.id),
      fullMark: 100
    }));
  };

  const getOverallScore = () => {
    if (tasks.length === 0) return 0;
    const totalCompletion = tasks.reduce((sum, task) => sum + getTaskCompletionRate(task.id), 0);
    return Math.round(totalCompletion / tasks.length);
  };

  const getPeriodDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - totalDays + 1);
    
    const dates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const getWeeklySummary = () => {
    const weeks = [];
    const today = new Date();
    
    for (let i = 0; i < 4; i++) {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (i * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      
      let totalCompletions = 0;
      let totalPossible = 0;
      
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        tasks.forEach(task => {
          totalPossible++;
          if (dailyCompletion[dateStr] && dailyCompletion[dateStr][task.id]) {
            totalCompletions++;
          }
        });
      }
      
      weeks.push({
        week: `Week ${4 - i}`,
        completion: totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0,
        startDate: weekStart.toLocaleDateString(),
        endDate: weekEnd.toLocaleDateString()
      });
    }
    
    return weeks.reverse();
  };

  const getMonthlySummary = () => {
    const months = [];
    const today = new Date();
    
    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      
      let totalCompletions = 0;
      let totalPossible = 0;
      
      for (let d = new Date(monthDate); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        tasks.forEach(task => {
          totalPossible++;
          if (dailyCompletion[dateStr] && dailyCompletion[dateStr][task.id]) {
            totalCompletions++;
          }
        });
      }
      
      months.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        completion: totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0
      });
    }
    
    return months.reverse();
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Star className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Star className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Daily Progress Tracker</h1>
          <p className="text-gray-600">Track your daily habits and visualize your progress with priority scheduling</p>
        </div>

        {/* View Mode Selector */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg p-1 shadow-md">
            {['daily', 'weekly', 'monthly'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-md transition-all ${
                  viewMode === mode
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500 transform hover:scale-105 transition-transform">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Overall Score</p>
                <p className="text-2xl font-bold text-gray-800">{getOverallScore()}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500 transform hover:scale-105 transition-transform">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Tracking Period</p>
                <p className="text-2xl font-bold text-gray-800">{totalDays} days</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-orange-500 transform hover:scale-105 transition-transform">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Active Tasks</p>
                <p className="text-2xl font-bold text-gray-800">{tasks.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-purple-500 transform hover:scale-105 transition-transform">
            <div className="flex items-center">
              <Award className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Best Streak</p>
                <p className="text-2xl font-bold text-gray-800">
                  {Math.max(...tasks.map(task => getStreak(task.id)), 0)} days
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Task Management */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Task Management</h2>
            
            {/* Add New Task */}
            <div className="space-y-3 mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="Add a new daily task..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && addTask()}
                />
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
                <button
                  onClick={addTask}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all transform hover:scale-105 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Period Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tracking Period
              </label>
              <select
                value={totalDays}
                onChange={(e) => setTotalDays(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg transform hover:scale-105 transition-all border-l-4"
                  style={{ borderLeftColor: priorityColors[task.priority] }}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(task.priority)}
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: task.color }}
                      />
                    </div>
                    
                    {editingTask === task.id ? (
                      <div className="flex items-center space-x-2 flex-1">
                        <input
                          type="text"
                          defaultValue={task.name}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              updateTask(task.id, { name: e.target.value });
                            }
                          }}
                          autoFocus
                        />
                        <select
                          defaultValue={task.priority}
                          onChange={(e) => updateTask(task.id, { priority: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <button
                          onClick={() => setEditingTask(null)}
                          className="p-1 text-green-500 hover:bg-green-50 rounded"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-800">{task.name}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                            {task.priority}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {getTaskCompletionRate(task.id)}% completed • {getStreak(task.id)} day streak
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTaskCompletion(task.id)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all transform hover:scale-105 ${
                        dailyCompletion[getTodayDate()]?.[task.id]
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {dailyCompletion[getTodayDate()]?.[task.id] ? 'Done Today' : 'Mark Done'}
                    </button>
                    
                    {editingTask !== task.id && (
                      <button
                        onClick={() => setEditingTask(task.id)}
                        className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => removeTask(task.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-all transform hover:scale-110"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visualization */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Progress Visualization</h2>
              <button
                onClick={() => setShowSummaries(!showSummaries)}
                className="flex items-center space-x-1 px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <span className="text-sm">Summaries</span>
                {showSummaries ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            
            {viewMode === 'daily' && tasks.length > 0 && (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={getRadarData()}>
                    <PolarGrid gridType="polygon" className="opacity-30" />
                    <PolarAngleAxis 
                      dataKey="task" 
                      tick={{ fontSize: 12, fill: '#4B5563' }}
                      className="text-gray-600"
                    />
                    <PolarRadiusAxis 
                      angle={0} 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickCount={6}
                    />
                    <Radar
                      name="Completion Rate"
                      dataKey="completion"
                      stroke="#8B5CF6"
                      fill="url(#colorGradient)"
                      fillOpacity={0.3}
                      strokeWidth={3}
                      dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 6 }}
                    />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {viewMode === 'weekly' && (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getWeeklySummary()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} />
                    <Bar dataKey="completion" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {viewMode === 'monthly' && (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getMonthlySummary()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} />
                    <Line 
                      type="monotone" 
                      dataKey="completion" 
                      stroke="#8B5CF6" 
                      strokeWidth={3}
                      dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="h-96 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Add some tasks to see your progress visualization</p>
                </div>
              </div>
            )}
            
            {/* Summaries */}
            {showSummaries && (
              <div className="mt-6 space-y-4">
                {viewMode === 'weekly' && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-800 mb-2">Weekly Summary</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {getWeeklySummary().map((week, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{week.week}:</span>
                          <span className="font-medium">{week.completion}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {viewMode === 'monthly' && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h3 className="font-semibold text-green-800 mb-2">Monthly Summary</h3>
                    <div className="space-y-1 text-sm">
                      {getMonthlySummary().map((month, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{month.month}:</span>
                          <span className="font-medium">{month.completion}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">Priority Breakdown</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {['high', 'medium', 'low'].map(priority => {
                      const priorityTasks = tasks.filter(task => task.priority === priority);
                      const avgCompletion = priorityTasks.length > 0 
                        ? Math.round(priorityTasks.reduce((sum, task) => sum + getTaskCompletionRate(task.id), 0) / priorityTasks.length)
                        : 0;
                      
                      return (
                        <div key={priority} className="text-center">
                          <div className="font-medium capitalize">{priority}</div>
                          <div className="text-lg font-bold" style={{ color: priorityColors[priority] }}>
                            {avgCompletion}%
                          </div>
                          <div className="text-xs text-gray-600">
                            {priorityTasks.length} tasks
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Daily View */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Daily History</h2>
          
          <div className="overflow-x-auto">
            <div className="flex space-x-2 pb-4">
              {getPeriodDates().reverse().map((date, index) => (
                <div key={index} className="flex-shrink-0 w-24">
                  <div className="text-center mb-2">
                    <div className="text-xs text-gray-500">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-sm font-medium text-gray-700">
                      {date.getDate()}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    {tasks.map(task => {
                      const dateStr = date.toISOString().split('T')[0];
                      const isCompleted = dailyCompletion[dateStr]?.[task.id];
                      return (
                        <button
                          key={task.id}
                          onClick={() => toggleTaskCompletion(task.id, dateStr)}
                          className={`w-full h-6 rounded text-xs font-medium transition-all transform hover:scale-105 ${
                            isCompleted 
                              ? 'text-white shadow-sm'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          }`}
                          style={{ 
                            backgroundColor: isCompleted ? task.color : undefined 
                          }}
                          title={`${task.name} - ${date.toLocaleDateString()}`}
                        >
                          {isCompleted ? '✓' : '○'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyProgressTracker;