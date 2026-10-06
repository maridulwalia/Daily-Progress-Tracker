import React, { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { Plus, X, Calendar, TrendingUp, Award, Target, Edit2, Save, AlertCircle, ChevronDown, ChevronUp, Star, Upload, CheckCircle2, Circle, BarChart2, Sparkles, Filter, Settings, ListTodo, PieChart, Download, Trash2, Home, Clock } from 'lucide-react';
import { getTasks, saveTask, deleteDBTask, getCompletions, saveCompletion } from './db';

const DAYS_OF_WEEK = [
  { id: 0, label: 'Su', full: 'Sunday' },
  { id: 1, label: 'Mo', full: 'Monday' },
  { id: 2, label: 'Tu', full: 'Tuesday' },
  { id: 3, label: 'We', full: 'Wednesday' },
  { id: 4, label: 'Th', full: 'Thursday' },
  { id: 5, label: 'Fr', full: 'Friday' },
  { id: 6, label: 'Sa', full: 'Saturday' }
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
  const [dailyChartType, setDailyChartType] = useState('bars');
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'analytics' | 'manage' | 'settings'
  const [isLoading, setIsLoading] = useState(true);

  const fileInputRef = useRef(null);

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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/);

      const newTasks = [];
      let baseLength = tasks.length;
      let timeOffset = 0;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) continue;

        const parts = line.split('|').map(p => p.trim());
        const taskName = parts[0];
        if (!taskName) continue;

        let priority = 'medium';
        if (parts[1] && ['low', 'medium', 'high'].includes(parts[1].toLowerCase())) {
          priority = parts[1].toLowerCase();
        }

        let days = [0, 1, 2, 3, 4, 5, 6];
        if (parts[2]) {
          const dayNameMap = {
            sun: 0, sunday: 0, su: 0,
            mon: 1, monday: 1, mo: 1,
            tue: 2, tues: 2, tuesday: 2, tu: 2,
            wed: 3, wednesday: 3, we: 3,
            thu: 4, thur: 4, thurs: 4, thursday: 4, th: 4,
            fri: 5, friday: 5, fr: 5,
            sat: 6, saturday: 6, sa: 6
          };
          const tokens = parts[2].split(/\s*,\s*/);
          const parsedDays = tokens.map(tok => {
            const num = Number(tok);
            if (!isNaN(num) && num >= 0 && num <= 6) return num;
            const mapped = dayNameMap[tok.toLowerCase()];
            return mapped !== undefined ? mapped : NaN;
          }).filter(d => !isNaN(d));

          if (parsedDays.length > 0) {
            days = Array.from(new Set(parsedDays)).sort((a, b) => a - b);
          }
        }

        const newTask = {
          id: Date.now() + timeOffset,
          name: taskName,
          color: colors[baseLength % colors.length],
          priority,
          frequency: days,
          completedDays: 0,
          streak: 0,
          createdAt: new Date().toISOString()
        };

        newTasks.push(newTask);
        baseLength++;
        timeOffset++;
      }

      if (newTasks.length > 0) {
        const updatedTasks = [...tasks, ...newTasks].sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        setTasks(updatedTasks);
        for (const t of newTasks) {
          await saveTask(t);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
          if (i === 0) {
            continue;
          }
          break;
        }
      }
    }

    return streak;
  };

  const getRadarData = () => {
    let relevantTasks = tasks;
    if (viewMode === 'daily' || totalDays === 1) {
      const todayObj = new Date();
      relevantTasks = tasks.filter(t => isTaskActiveOnDate(t, todayObj));
    } else {
      const periodDates = getPeriodDates();
      relevantTasks = tasks.filter(t => periodDates.some(d => isTaskActiveOnDate(t, d)));
    }

    return relevantTasks.map(task => ({
      task: task.name,
      completion: getTaskCompletionRate(task.id),
      fullMark: 100
    }));
  };

  const getOverallScore = () => {
    const todayObj = new Date();
    let relevantTasks = tasks;
    if (totalDays === 1) {
      relevantTasks = tasks.filter(t => isTaskActiveOnDate(t, todayObj));
    } else {
      const periodDates = getPeriodDates();
      relevantTasks = tasks.filter(t => periodDates.some(d => isTaskActiveOnDate(t, d)));
    }

    if (relevantTasks.length === 0) return 0;
    const totalCompletion = relevantTasks.reduce((sum, task) => sum + getTaskCompletionRate(task.id), 0);
    return Math.round(totalCompletion / relevantTasks.length);
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

  const exportData = () => {
    const dataStr = JSON.stringify({ tasks, completions: dailyCompletion }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `progress-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const clearAllData = async () => {
    if (window.confirm('⚠️ This will permanently delete all tasks and completion history. Are you sure?')) {
      setTasks([]);
      setDailyCompletion({});
      const db = await import('./db').then(m => m.initDB());
      const tx = db.transaction(['tasks', 'completions'], 'readwrite');
      await tx.objectStore('tasks').clear();
      await tx.objectStore('completions').clear();
      await tx.done;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Progress Tracker</h1>
                <p className="text-xs text-gray-500">Build Better Habits</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('today')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'today'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Home className="h-4 w-4" />
                Today
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <PieChart className="h-4 w-4" />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'manage'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ListTodo className="h-4 w-4" />
                Manage
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'settings'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TODAY TAB */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Today's Progress</p>
                    <p className="text-3xl font-bold text-indigo-600">
                      {getActiveTasksForToday().length > 0
                        ? `${Math.round((getTodayCompletionCount() / getActiveTasksForToday().length) * 100)}%`
                        : '0%'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getTodayCompletionCount()} of {getActiveTasksForToday().length} completed
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Target className="h-7 w-7 text-indigo-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active Tasks</p>
                    <p className="text-3xl font-bold text-green-600">{getActiveTasksForToday().length}</p>
                    <p className="text-xs text-gray-500 mt-1">scheduled for today</p>
                  </div>
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                    <Calendar className="h-7 w-7 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Best Streak</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {Math.max(...tasks.map(task => getStreak(task.id)), 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">consecutive days</p>
                  </div>
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
                    <Award className="h-7 w-7 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Habits</p>
                    <p className="text-3xl font-bold text-purple-600">{tasks.length}</p>
                    <p className="text-xs text-gray-500 mt-1">in your routine</p>
                  </div>
                  <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-7 w-7 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* 100% Celebration Banner */}
            {getActiveTasksForToday().length > 0 && getTodayCompletionCount() === getActiveTasksForToday().length && (
              <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-6 border-2 border-green-300 shadow-lg">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
                  <span className="text-2xl font-bold text-green-700">🎉 Perfect Day! All Tasks Completed! 🎉</span>
                  <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
                </div>
                <p className="text-center text-green-600">You've crushed every habit today. Keep up the amazing momentum!</p>
              </div>
            )}

            {/* Today's Checklist */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Today's Checklist</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                {getActiveTasksForToday().length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-500 rounded-full"
                        style={{
                          width: `${Math.round((getTodayCompletionCount() / getActiveTasksForToday().length) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-700">
                      {Math.round((getTodayCompletionCount() / getActiveTasksForToday().length) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {getActiveTasksForToday().length === 0 ? (
                <div className="text-center py-16">
                  <Calendar className="h-20 w-20 mx-auto mb-4 text-gray-300" />
                  <p className="text-xl font-medium text-gray-700 mb-2">No tasks scheduled for today</p>
                  <p className="text-gray-500">Enjoy your day off or add new habits in the Manage tab.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getActiveTasksForToday()
                    .sort((a, b) => {
                      const aDone = !!dailyCompletion[getTodayDate()]?.[a.id];
                      const bDone = !!dailyCompletion[getTodayDate()]?.[b.id];
                      if (aDone !== bDone) return aDone ? 1 : -1;
                      const po = { high: 3, medium: 2, low: 1 };
                      return po[b.priority] - po[a.priority];
                    })
                    .map(task => {
                      const isDone = !!dailyCompletion[getTodayDate()]?.[task.id];
                      return (
                        <div
                          key={task.id}
                          onClick={() => toggleTaskCompletion(task.id)}
                          className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                            isDone
                              ? 'bg-green-50 border-green-300 hover:bg-green-100'
                              : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                              isDone
                                ? 'bg-green-500 text-white shadow-md scale-110'
                                : 'border-2 border-gray-300 group-hover:border-indigo-500 bg-white'
                            }`}>
                              {isDone && <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`font-semibold text-base truncate ${
                                  isDone ? 'line-through text-gray-500' : 'text-gray-900'
                                }`}>
                                  {task.name}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-xs">
                                <span
                                  className="px-2 py-0.5 rounded-full font-medium capitalize"
                                  style={{
                                    backgroundColor: priorityColors[task.priority] + '20',
                                    color: priorityColors[task.priority]
                                  }}
                                >
                                  {task.priority}
                                </span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-600 flex items-center gap-1">
                                  <Award className="h-3 w-3" />
                                  {getStreak(task.id)} day streak
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="ml-3">
                            <span className="w-3 h-3 rounded-full block" style={{ backgroundColor: task.color }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Period Selector & View Mode */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tracking Period
                  </label>
                  <select
                    value={totalDays}
                    onChange={(e) => setTotalDays(parseInt(e.target.value))}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  >
                    <option value={1}>Today only</option>
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    View Mode
                  </label>
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    {['daily', 'weekly', 'monthly'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          viewMode === mode
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {(viewMode === 'daily' || totalDays === 1) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chart Type
                    </label>
                    <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setDailyChartType('bars')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          dailyChartType === 'bars' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'
                        }`}
                      >
                        Bars
                      </button>
                      <button
                        onClick={() => setDailyChartType('radar')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          dailyChartType === 'radar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'
                        }`}
                      >
                        Radar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Visualization */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Progress Visualization</h2>

              {tasks.length === 0 ? (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Target className="h-20 w-20 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Add habits to see your progress</p>
                  </div>
                </div>
              ) : viewMode === 'daily' && getActiveTasksForToday().length === 0 ? (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Calendar className="h-20 w-20 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No tasks scheduled for today</p>
                  </div>
                </div>
              ) : viewMode === 'daily' && dailyChartType === 'bars' ? (
                <div className="h-96 overflow-y-auto pr-2 space-y-3">
                  {getActiveTasksForToday().map(task => {
                    const rate = getTaskCompletionRate(task.id);
                    const isDone = !!dailyCompletion[getTodayDate()]?.[task.id];
                    return (
                      <div key={task.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: task.color }} />
                            <span className={`font-semibold ${isDone ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                              {task.name}
                            </span>
                            {isDone && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">✓ DONE</span>}
                          </div>
                          <span className="text-sm font-bold text-gray-700">{rate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-3 rounded-full transition-all duration-500"
                            style={{ width: `${rate}%`, backgroundColor: task.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === 'daily' && dailyChartType === 'radar' ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={getRadarData()}>
                      <PolarGrid gridType="polygon" />
                      <PolarAngleAxis dataKey="task" tick={{ fontSize: 12, fill: '#4B5563' }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar
                        name="Completion"
                        dataKey="completion"
                        stroke="#6366F1"
                        fill="#6366F1"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : viewMode === 'weekly' ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getWeeklySummary()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Completion']} />
                      <Bar dataKey="completion" fill="#6366F1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getMonthlySummary()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Completion']} />
                      <Line
                        type="monotone"
                        dataKey="completion"
                        stroke="#6366F1"
                        strokeWidth={3}
                        dot={{ fill: '#6366F1', r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Statistics Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-lg text-gray-900 mb-4">Priority Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                  {['high', 'medium', 'low'].map(priority => {
                    const priorityTasks = tasks.filter(task => task.priority === priority);
                    const avgCompletion = priorityTasks.length > 0
                      ? Math.round(priorityTasks.reduce((sum, task) => sum + getTaskCompletionRate(task.id), 0) / priorityTasks.length)
                      : 0;

                    return (
                      <div key={priority} className="text-center p-4 bg-gray-50 rounded-xl">
                        <div className="text-xs font-medium text-gray-600 capitalize mb-2">{priority}</div>
                        <div className="text-3xl font-bold mb-1" style={{ color: priorityColors[priority] }}>
                          {avgCompletion}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {priorityTasks.length} {priorityTasks.length === 1 ? 'task' : 'tasks'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-lg text-gray-900 mb-4">Overall Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Overall Score</span>
                    <span className="text-lg font-bold text-indigo-600">{getOverallScore()}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Total Habits</span>
                    <span className="text-lg font-bold text-gray-900">{tasks.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Best Streak</span>
                    <span className="text-lg font-bold text-orange-600">
                      {Math.max(...tasks.map(task => getStreak(task.id)), 0)} days
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily History (when totalDays > 1) */}
            {totalDays > 1 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Daily History</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 bg-white sticky left-0 z-10 min-w-[180px]" style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>
                          Task
                        </th>
                        {getPeriodDates().reverse().map((date, index) => {
                          const isToday = date.toLocaleDateString('en-CA') === getTodayDate();
                          return (
                            <th
                              key={index}
                              className={`text-center py-2 px-2 text-xs font-medium min-w-[48px] ${
                                isToday ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600'
                              }`}
                            >
                              <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                              <div className="text-sm">{date.getDate()}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tasks.map(task => (
                        <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-4 bg-white sticky left-0 z-10" style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>
                            <div className="flex items-center space-x-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                              <span className="text-sm font-medium text-gray-800 truncate max-w-[130px]">
                                {task.name}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {getTaskCompletionRate(task.id)}%
                              </span>
                            </div>
                          </td>
                          {getPeriodDates().reverse().map((date, index) => {
                            const dateStr = date.toLocaleDateString('en-CA');
                            const isCompleted = !!dailyCompletion[dateStr]?.[task.id];
                            const isActive = isTaskActiveOnDate(task, date);
                            const isToday = dateStr === getTodayDate();

                            return (
                              <td key={index} className={`text-center py-1.5 px-1 ${isToday ? 'bg-indigo-50' : ''}`}>
                                {isActive ? (
                                  <button
                                    onClick={() => toggleTaskCompletion(task.id, dateStr)}
                                    className={`w-7 h-7 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition-transform hover:scale-110 ${
                                      isCompleted
                                        ? 'text-white shadow-sm'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-400'
                                    }`}
                                    style={{
                                      backgroundColor: isCompleted ? task.color : undefined
                                    }}
                                  >
                                    {isCompleted ? '✓' : '○'}
                                  </button>
                                ) : (
                                  <div className="w-7 h-7 mx-auto flex items-center justify-center text-gray-300 text-xs">
                                    —
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MANAGE TAB */}
        {activeTab === 'manage' && (
          <div className="space-y-6">
            {/* Add New Habit */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Habit</h2>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="Enter habit name..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && addTask()}
                  />
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                  <button
                    onClick={addTask}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium flex items-center gap-2 justify-center"
                  >
                    <Plus className="h-5 w-5" />
                    Add Habit
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Repeat on:</label>
                  <div className="flex gap-2">
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
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                          newTaskDays.includes(day.id)
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={day.full}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk Import */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Bulk Import</h3>
                  <p className="text-sm text-gray-500 mt-1">Upload a .txt file to import multiple habits at once</p>
                </div>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <Upload className="h-4 w-4" />
                  Import .txt File
                </button>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-xs text-gray-600 font-mono">
                <div className="font-semibold mb-2">Format: TaskName | Priority | Days</div>
                <div>Example:</div>
                <div className="mt-1 space-y-0.5">
                  <div>Morning Workout | high | 1,3,5</div>
                  <div>Read Book | medium | 0,1,2,3,4,5,6</div>
                  <div>Meditate | high | Mon,Wed,Fri</div>
                </div>
              </div>
            </div>

            {/* All Habits List */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">All Habits ({tasks.length})</h2>

              {tasks.length === 0 ? (
                <div className="text-center py-16">
                  <ListTodo className="h-20 w-20 mx-auto mb-4 text-gray-300" />
                  <p className="text-xl font-medium text-gray-700 mb-2">No habits yet</p>
                  <p className="text-gray-500">Add your first habit above to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />

                        {editingTask === task.id ? (
                          <div className="flex flex-col space-y-3 flex-1">
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editTaskData.name}
                                onChange={(e) => setEditTaskData({...editTaskData, name: e.target.value})}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                onKeyPress={(e) => e.key === 'Enter' && updateTask(task.id, editTaskData)}
                                autoFocus
                              />
                              <select
                                value={editTaskData.priority}
                                onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value})}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              {DAYS_OF_WEEK.map(day => (
                                <button
                                  key={day.id}
                                  onClick={() => {
                                    const newDays = editTaskData.frequency.includes(day.id)
                                      ? editTaskData.frequency.filter(d => d !== day.id)
                                      : [...editTaskData.frequency, day.id].sort((a,b)=>a-b);
                                    setEditTaskData({...editTaskData, frequency: newDays});
                                  }}
                                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                                    editTaskData.frequency.includes(day.id)
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-semibold text-gray-900">{task.name}</span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                                style={{
                                  backgroundColor: priorityColors[task.priority] + '20',
                                  color: priorityColors[task.priority]
                                }}
                              >
                                {task.priority}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              {DAYS_OF_WEEK.map(day => (
                                <span
                                  key={day.id}
                                  className={`px-1.5 py-0.5 rounded ${
                                    task.frequency.includes(day.id)
                                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                                      : 'text-gray-400'
                                  }`}
                                >
                                  {day.label}
                                </span>
                              ))}
                              <span className="mx-2">•</span>
                              <span>{getTaskCompletionRate(task.id)}% completed</span>
                              <span>•</span>
                              <span>{getStreak(task.id)} day streak</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {editingTask === task.id ? (
                          <button
                            onClick={() => updateTask(task.id, editTaskData)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <Save className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditing(task)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                        )}

                        <button
                          onClick={() => removeTask(task.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Data Management</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <h3 className="font-semibold text-gray-900">Export Data</h3>
                    <p className="text-sm text-gray-500 mt-1">Download a backup of all your habits and completion history</p>
                  </div>
                  <button
                    onClick={exportData}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    <Download className="h-4 w-4" />
                    Export JSON
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-200">
                  <div>
                    <h3 className="font-semibold text-red-900">Clear All Data</h3>
                    <p className="text-sm text-red-600 mt-1">Permanently delete all habits and completion history</p>
                  </div>
                  <button
                    onClick={clearAllData}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear Data
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
              <div className="prose prose-sm text-gray-600">
                <p>
                  <strong>Progress Tracker</strong> helps you build better habits through consistent daily tracking.
                </p>
                <p className="mt-3">
                  <strong>Features:</strong>
                </p>
                <ul className="mt-2 space-y-1">
                  <li>✅ Flexible scheduling - choose which days each habit repeats</li>
                  <li>📊 Visual analytics with multiple chart types</li>
                  <li>🔥 Streak tracking with protection for ongoing days</li>
                  <li>📥 Bulk import via text files</li>
                  <li>💾 Secure local storage with IndexedDB</li>
                  <li>📱 Fully responsive design</li>
                </ul>
                <p className="mt-4 text-xs text-gray-500">
                  Built with React, TailwindCSS, Recharts, and IndexedDB
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DailyProgressTracker;
