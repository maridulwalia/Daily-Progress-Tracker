import React, { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { Plus, X, Calendar, TrendingUp, Award, Target, Edit2, Save, AlertCircle, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { getTasks, saveTask, deleteDBTask, getCompletions, saveCompletion } from './db';

const DAYS_OF_WEEK = [
  { id: 0, label: 'Su' },
  { id: 1, label: 'Mo' },
  { id: 2, label: 'Tu' },
  { id: 3, label: 'We' },
  { id: 4, label: 'Th' },
  { id: 5, label: 'Fr' },
  { id: 6, label: 'Sa' }
];

const DailyProgressTracker = () => {
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskDays, setNewTaskDays] = useState([0,1,2,3,4,5,6]);

  const [dailyCompletion, setDailyCompletion] = useState({});
  const [totalDays, setTotalDays] = useState(1);

  const [editingTask, setEditingTask] = useState(null);
  const [editTaskData, setEditTaskData] = useState(null);

  const [viewMode, setViewMode] = useState('daily');
  const [showSummaries, setShowSummaries] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  const priorityColors = {
    high: '#FF4757',
    medium: '#FFA502',
    low: '#2ED573'
  };

  const isTaskActiveOnDate = (task, dateObj) => {
    if (!task.frequency) return true;
    return task.frequency.includes(dateObj.getDay());
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedTasks = await getTasks();
        const savedCompletions = await getCompletions();

        if (savedTasks.length > 0) {
          setTasks(savedTasks.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }));
        } else {
          const lsTasks = localStorage.getItem('progressTrackerTasks');
          if (lsTasks) {
             const parsed = JSON.parse(lsTasks);
             setTasks(parsed);
             parsed.forEach(t => saveTask(t));
          }
        }

        if (Object.keys(savedCompletions).length > 0) {
          setDailyCompletion(savedCompletions);
        } else {
          const lsComps = localStorage.getItem('progressTrackerCompletions');
          if (lsComps) {
             const parsed = JSON.parse(lsComps);
             setDailyCompletion(parsed);
             Object.keys(parsed).forEach(date => saveCompletion(date, parsed[date]));
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const addTask = async () => {
    if (newTaskName.trim()) {
      const newTask = {
        id: Date.now(),
        name: newTaskName.trim(),
        color: colors[tasks.length % colors.length],
        priority: newTaskPriority,
        frequency: newTaskDays,
        completedDays: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      };

      const updatedTasks = [...tasks, newTask].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      setTasks(updatedTasks);
      await saveTask(newTask);
      setNewTaskName('');
      setNewTaskPriority('medium');
      setNewTaskDays([0,1,2,3,4,5,6]);
    }
  };

  const startEditing = (task) => {
    setEditingTask(task.id);
    setEditTaskData({
      name: task.name,
      priority: task.priority,
      frequency: task.frequency || [0,1,2,3,4,5,6]
    });
  };

  const updateTask = async (taskId, updates) => {
    let modifiedTask = null;
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        modifiedTask = { ...task, ...updates };
        return modifiedTask;
      }
      return task;
    }).sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    setTasks(updatedTasks);
    if (modifiedTask) await saveTask(modifiedTask);
    setEditingTask(null);
  };

  const removeTask = async (taskId) => {
    setTasks(tasks.filter(task => task.id !== taskId));
    await deleteDBTask(taskId);

    const newDailyCompletion = { ...dailyCompletion };
    const dates = Object.keys(newDailyCompletion);
    for (const date of dates) {
      if (newDailyCompletion[date][taskId] !== undefined) {
        delete newDailyCompletion[date][taskId];
        await saveCompletion(date, newDailyCompletion[date]);
      }
    }
    setDailyCompletion(newDailyCompletion);
  };

  const toggleTaskCompletion = async (taskId, date = getTodayDate()) => {
    const newDailyCompletion = { ...dailyCompletion };
    if (!newDailyCompletion[date]) {
      newDailyCompletion[date] = {};
    }
    newDailyCompletion[date][taskId] = !newDailyCompletion[date][taskId];
    setDailyCompletion(newDailyCompletion);
    await saveCompletion(date, newDailyCompletion[date]);
  };

  const getTodayDate = () => {
    return new Date().toLocaleDateString('en-CA');
  };

  const getTaskCompletionRate = (taskId) => {
    let completedCount = 0;
    let expectedCount = 0;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - totalDays + 1);

    const taskObj = tasks.find(t => t.id === taskId);
    if (!taskObj) return 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (isTaskActiveOnDate(taskObj, d)) {
        expectedCount++;
        const dateStr = d.toLocaleDateString('en-CA');
        if (dailyCompletion[dateStr] && dailyCompletion[dateStr][taskId]) {
          completedCount++;
        }
      }
    }

    if (expectedCount === 0) return 0;
    return Math.round((completedCount / expectedCount) * 100);
  };

  const getStreak = (taskId) => {
    let streak = 0;
    const today = new Date();
    const taskObj = tasks.find(t => t.id === taskId);
    if (!taskObj) return 0;

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      if (isTaskActiveOnDate(taskObj, date)) {
        const dateStr = date.toLocaleDateString('en-CA');
        if (dailyCompletion[dateStr] && dailyCompletion[dateStr][taskId]) {
          streak++;
        } else {
          break;
        }
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
        const dateStr = d.toLocaleDateString('en-CA');
        tasks.forEach(task => {
          if (isTaskActiveOnDate(task, d)) {
            totalPossible++;
            if (dailyCompletion[dateStr] && dailyCompletion[dateStr][task.id]) {
              totalCompletions++;
            }
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
        const dateStr = d.toLocaleDateString('en-CA');
        tasks.forEach(task => {
          if (isTaskActiveOnDate(task, d)) {
            totalPossible++;
            if (dailyCompletion[dateStr] && dailyCompletion[dateStr][task.id]) {
              totalCompletions++;
            }
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

  const getDayLabel = () => {
    switch (totalDays) {
      case 1:
        return 'Today';
      case 7:
        return 'Last 7 days';
      case 14:
        return 'Last 14 days';
      case 30:
        return 'Last 30 days';
      default:
        return `Last ${totalDays} days`;
    }
  };

  const getActiveTasksForToday = () => {
    const todayObj = new Date();
    return tasks.filter(task => isTaskActiveOnDate(task, todayObj));
  };

  const getTodayCompletionCount = () => {
    const today = getTodayDate();
    const todayObj = new Date();

    let count = 0;
    tasks.forEach(task => {
       if (isTaskActiveOnDate(task, todayObj)) {
         if (dailyCompletion[today] && dailyCompletion[today][task.id]) {
            count++;
         }
       }
    });
    return count;
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading progress...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Daily Progress Tracker</h1>
          <p className="text-gray-600">Track your tasks and visualize your progress with priority scheduling</p>
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
                <p className="text-2xl font-bold text-gray-800">{getDayLabel()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-orange-500 transform hover:scale-105 transition-transform">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">
                  {totalDays === 1 ? 'Completed Today' : 'Total Active Tasks'}
                </p>
                <p className="text-2xl font-bold text-gray-800">
                  {totalDays === 1 ? `${getTodayCompletionCount()}/${getActiveTasksForToday().length}` : tasks.length}
                </p>
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
            <div className="space-y-4 mb-8">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="Add a new task..."
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
              <div className="flex gap-2 items-center">
                <label className="text-sm font-medium text-gray-700 w-20">Repeat on:</label>
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.id}
                    onClick={() => {
                      if (newTaskDays.includes(day.id)) {
                        setNewTaskDays(newTaskDays.filter(d => d !== day.id));
                      } else {
                        setNewTaskDays([...newTaskDays, day.id].sort((a,b)=>a-b));
                      }
                    }}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                      newTaskDays.includes(day.id) ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
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
                <option value={1}>Today only</option>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg transform hover:scale-105 transition-all border-l-4"
                  style={{ borderLeftColor: priorityColors[task.priority] }}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(task.priority)}
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: task.color }}
                      />
                    </div>

                    {editingTask === task.id ? (
                      <div className="flex flex-col space-y-2 flex-1 mr-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editTaskData.name}
                            onChange={(e) => setEditTaskData({...editTaskData, name: e.target.value})}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                updateTask(task.id, editTaskData);
                              }
                            }}
                            autoFocus
                          />
                          <select
                            value={editTaskData.priority}
                            onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value})}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                          <button
                            onClick={() => updateTask(task.id, editTaskData)}
                            className="p-1 text-green-500 hover:bg-green-50 rounded bg-white shadow-sm"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center space-x-1">
                          {DAYS_OF_WEEK.map(day => (
                            <button
                              key={day.id}
                              onClick={() => {
                                const newDays = editTaskData.frequency.includes(day.id)
                                  ? editTaskData.frequency.filter(d => d !== day.id)
                                  : [...editTaskData.frequency, day.id].sort((a,b)=>a-b);
                                setEditTaskData({...editTaskData, frequency: newDays});
                              }}
                              className={`w-6 h-6 rounded-full text-[10px] font-medium transition-colors ${
                                editTaskData.frequency.includes(day.id) ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
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
                          {totalDays === 1 ? (
                            isTaskActiveOnDate(task, new Date()) ? (
                              dailyCompletion[getTodayDate()]?.[task.id] ? 'Completed today' : 'Not completed today'
                            ) : (
                              'Not scheduled today'
                            )
                          ) : (
                            `${getTaskCompletionRate(task.id)}% completed • ${getStreak(task.id)} day streak`
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {editingTask !== task.id && (
                       isTaskActiveOnDate(task, new Date()) ? (
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
                       ) : (
                         <span className="text-xs text-gray-400 px-2 italic">Off today</span>
                       )
                    )}

                    {editingTask !== task.id && (
                      <button
                        onClick={() => startEditing(task)}
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

                {/* Today's Summary for 1-day view */}
                {totalDays === 1 && (
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <h3 className="font-semibold text-indigo-800 mb-2">Today's Progress</h3>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600 mb-1">
                        {getTodayCompletionCount()}/{getActiveTasksForToday().length}
                      </div>
                      <div className="text-sm text-gray-600">
                        {getActiveTasksForToday().length > 0 ? `${Math.round((getTodayCompletionCount() / getActiveTasksForToday().length) * 100)}% completed` : 'No tasks assigned for today'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Daily View */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {totalDays === 1 ? "Today's Tasks" : "Daily History"}
          </h2>

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
                      const dateStr = date.toLocaleDateString('en-CA');
                      const isCompleted = dailyCompletion[dateStr]?.[task.id];
                      const isActive = isTaskActiveOnDate(task, date);

                      return (
                        <div key={task.id} className="w-full h-6 flex items-center justify-center">
                          {isActive ? (
                            <button
                              onClick={() => toggleTaskCompletion(task.id, dateStr)}
                              className={`w-full h-full rounded text-xs font-medium transition-all transform hover:scale-105 ${
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
                          ) : (
                            <div
                              className="w-[90%] h-[90%] rounded bg-gray-50/50 border border-gray-100 flex items-center justify-center cursor-not-allowed"
                              title={`${task.name} not scheduled for ${date.toLocaleDateString()}`}
                            >
                              <span className="text-gray-300 text-[10px]">-</span>
                            </div>
                          )}
                        </div>
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