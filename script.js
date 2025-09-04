document.addEventListener('DOMContentLoaded', () => {
    // 画面切り替えのイベントリスナー設定
    const navLinks = document.querySelectorAll('.nav-bar a');
    const contentSections = document.querySelectorAll('.content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.dataset.target;

            navLinks.forEach(nav => nav.classList.remove('active'));
            e.target.classList.add('active');

            contentSections.forEach(section => section.classList.remove('active'));
            document.getElementById(`${target}-content`).classList.add('active');
            
            // 画面を切り替えるたびにデータを再描画
            if (target === 'gantt') {
                fetchTasks();
                // ガントチャート画面に移動したら初期表示として現在の月を表示
                drawGanttChart(); 
            } else {
                fetchTasks();
            }
        });
    });
    
    // 最初の画面をアクティブにする
    document.querySelector('[data-target="form"]').click();

    // フォームのイベントリスナー
    document.getElementById('task-form').addEventListener('submit', saveTask);

    // 絞り込みフィルターのイベントリスナーをボタンクリックに変更
    document.getElementById('list-filter-button').addEventListener('click', renderTaskList);
    document.getElementById('gantt-filter-button').addEventListener('click', drawGanttChart);

    // ガントチャートのイベントリスナー
    document.getElementById('sat-holiday').addEventListener('change', () => drawGanttChart());
    document.getElementById('sun-holiday').addEventListener('change', () => drawGanttChart());
});

let tasks = [];
let nextId = 1;
let holidays = [];
let currentDisplayDate = new Date(); // 表示する月の基準日

// localStorageからタスクと休日を読み込み、表示
function fetchTasks() {
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
        nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    }
    const storedHolidays = localStorage.getItem('holidays');
    if (storedHolidays) {
        holidays = JSON.parse(storedHolidays);
    }
    renderTaskList();
    drawGanttChart();
    populateParentIdFilters();
}

// タスクをlocalStorageに保存
function saveTasksToLocalStorage() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// 休日をlocalStorageに保存
function saveHolidaysToLocalStorage() {
    localStorage.setItem('holidays', JSON.stringify(holidays));
}

// 親IDフィルターの選択肢を動的に生成
function populateParentIdFilters() {
    const parentIds = [...new Set(tasks.map(t => t.parent_id).filter(id => id !== null))].sort((a, b) => a - b);
    
    const listFilter = document.getElementById('list-parent-id-filter');
    const ganttFilter = document.getElementById('gantt-parent-id-filter');

    // 既存のオプションをクリア
    listFilter.innerHTML = '<option value="すべて">すべて</option>';
    ganttFilter.innerHTML = '<option value="すべて">すべて</option>';

    parentIds.forEach(id => {
        const option1 = document.createElement('option');
        option1.value = id;
        option1.textContent = id;
        listFilter.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = id;
        option2.textContent = id;
        ganttFilter.appendChild(option2);
    });
}


// カスタム休日を追加
function addCustomHoliday() {
    const holidayDateInput = document.getElementById('custom-holiday-date');
    const date = holidayDateInput.value;
    if (date && !holidays.includes(date)) {
        holidays.push(date);
        saveHolidaysToLocalStorage();
        drawGanttChart();
    }
    holidayDateInput.value = '';
}

// 絞り込み条件に従ってタスクをフィルタリングする関数
function filterTasks(view) {
    let filteredTasks = [...tasks];
    
    let statusFilter, priorityFilter, parentIdFilter;
    if (view === 'list') {
        statusFilter = document.getElementById('list-status-filter').value;
        priorityFilter = document.getElementById('list-priority-filter').value;
        parentIdFilter = document.getElementById('list-parent-id-filter').value;
    } else if (view === 'gantt') {
        statusFilter = document.getElementById('gantt-status-filter').value;
        priorityFilter = document.getElementById('gantt-priority-filter').value;
        parentIdFilter = document.getElementById('gantt-parent-id-filter').value;
    } else {
        return filteredTasks;
    }

    if (statusFilter !== 'すべて') {
        filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
    }
    
    if (priorityFilter !== 'すべて') {
        filteredTasks = filteredTasks.filter(task => task.priority === priorityFilter);
    }
    
    if (parentIdFilter !== 'すべて') {
        const parentId = parseInt(parentIdFilter, 10);
        filteredTasks = filteredTasks.filter(task => task.parent_id === parentId);
    }

    return filteredTasks;
}

// チケット一覧の表示
function renderTaskList() {
    const tbody = document.getElementById('task-table').querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    // フィルタリングされたタスクを取得
    const filteredTasks = filterTasks('list');

    // 親IDを最優先、次にIDの順でソート
    filteredTasks.sort((a, b) => {
        const parentA = a.parent_id === null ? Infinity : a.parent_id;
        const parentB = b.parent_id === null ? Infinity : b.parent_id;

        if (parentA !== parentB) {
            return parentA - parentB;
        }
        return a.id - b.id;
    }).forEach(task => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${task.id}</td>
            <td>${task.parent_id || ''}</td>
            <td>${task.name}</td>
            <td>${task.description || ''}</td>
            <td>${task.due_date}</td>
            <td>${task.priority}</td>
            <td>${task.status}</td>
            <td>
                <button onclick="editTask(${task.id})">編集</button>
                <button onclick="deleteTask(${task.id})">削除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// チケットを保存（新規/編集）
function saveTask(event) {
    event.preventDefault();
    const id = document.getElementById('task-id').value;
    const parentId = document.getElementById('parent-id').value ? parseInt(document.getElementById('parent-id').value) : null;
    const name = document.getElementById('name').value;
    const dueDate = document.getElementById('due-date').value;
    const priority = document.getElementById('priority').value;
    const status = document.getElementById('status').value;
    const description = document.getElementById('description').value;

    const newTask = {
        id: id ? parseInt(id) : nextId++,
        parent_id: parentId,
        name: name,
        description: description,
        due_date: dueDate,
        priority: priority,
        status: status,
        start_date: id ? tasks.find(t => t.id === parseInt(id)).start_date : new Date().toISOString().slice(0, 10)
    };

    if (id) {
        const index = tasks.findIndex(t => t.id === parseInt(id));
        if (index !== -1) {
            tasks[index] = newTask;
        }
    } else {
        tasks.push(newTask);
    }

    saveTasksToLocalStorage();
    resetForm();
    alert('タスクを保存しました！');
    document.querySelector('[data-target="list"]').click();
}

// フォームのリセット
function resetForm() {
    document.getElementById('task-form').reset();
    document.getElementById('task-id').value = '';
}

// 編集ボタン
function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        document.getElementById('task-id').value = task.id;
        document.getElementById('parent-id').value = task.parent_id || '';
        document.getElementById('name').value = task.name;
        document.getElementById('description').value = task.description || '';
        document.getElementById('due-date').value = task.due_date;
        document.getElementById('priority').value = task.priority;
        document.getElementById('status').value = task.status;
        document.querySelector('[data-target="form"]').click();
    }
}

// 削除機能を追加
function deleteTask(id) {
    if (confirm('このタスクを本当に削除しますか？')) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasksToLocalStorage();
        fetchTasks();
    }
}

// 休日かどうかを判定する関数
function isHoliday(date) {
    const satHoliday = document.getElementById('sat-holiday').checked;
    const sunHoliday = document.getElementById('sun-holiday').checked;
    const customHoliday = holidays.includes(date.toISOString().slice(0, 10));
    const weekday = date.getDay();
    return (satHoliday && weekday === 6) || (sunHoliday && weekday === 0) || customHoliday;
}

// 完了日までの残り営業日数を計算する関数
function getWorkingDaysUntilOrPast(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    let workingDays = 0;
    const isPast = due < today;
    let currentDate = isPast ? new Date(due) : new Date(today);
    const endDate = isPast ? new Date(today) : new Date(due);

    while (currentDate < endDate) {
        if (!isHoliday(currentDate)) {
            workingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return isPast ? workingDays : workingDays + 1;
}

// 月の移動ボタン
function changeMonth(delta) {
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() + delta);
    drawGanttChart();
}

// ガントチャートの描画
function drawGanttChart() {
    const container = document.getElementById('gantt-chart-area');
    if (!container) return;

    container.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), 1);
    const maxDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() + 1, 0);

    // 月表示のタイトルを更新
    document.getElementById('current-month-display').textContent = `${minDate.getFullYear()}年 ${minDate.getMonth() + 1}月`;
    
    // ヘッダー（日付）の描画
    const headerRow = document.createElement('div');
    headerRow.classList.add('gantt-chart-row', 'header-row');
    headerRow.innerHTML = `<div class="gantt-label"></div><div class="gantt-bar-container"></div>`;
    const datesContainer = headerRow.querySelector('.gantt-bar-container');
    const numDays = maxDate.getDate(); // その月の日数

    for (let i = 1; i <= numDays; i++) {
        const date = new Date(minDate.getFullYear(), minDate.getMonth(), i);
        const day = date.getDate();
        const weekday = date.getDay(); // 曜日を取得
        
        const dateCell = document.createElement('div');
        dateCell.classList.add('gantt-date-cell');
        dateCell.textContent = `${day}`; // 日付だけを表示
        if (isHoliday(date)) {
            dateCell.classList.add('holiday');
        } else if (weekday === 6) { // 土曜日
            dateCell.classList.add('saturday');
        } else if (weekday === 0) { // 日曜日
            dateCell.classList.add('sunday');
        }
        datesContainer.appendChild(dateCell);
    }
    container.appendChild(headerRow);

    // フィルタリングされたタスクを取得
    const filteredTasks = filterTasks('gantt');

    // 親IDを最優先、次にIDの順でソート
    filteredTasks.sort((a, b) => {
        const parentA = a.parent_id === null ? Infinity : a.parent_id;
        const parentB = b.parent_id === null ? Infinity : b.parent_id;

        if (parentA !== parentB) {
            return parentA - parentB;
        }
        return a.id - b.id;
    });

    // タスクバーの描画
    filteredTasks.forEach(task => {
        const startDate = new Date(task.start_date);
        const dueDate = new Date(task.due_date);
        startDate.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        // タスクが現在の表示期間内に含まれているかチェック
        if (startDate > maxDate || dueDate < minDate) {
            return;
        }

        const barRow = document.createElement('div');
        barRow.classList.add('gantt-chart-row');
        const barContainer = document.createElement('div');
        barContainer.classList.add('gantt-bar-container');
        
        // タスクバーの開始位置を計算
        const barStartDate = startDate < minDate ? minDate : startDate;
        const diffDays = (barStartDate - minDate) / (1000 * 60 * 60 * 24);
        const offset = diffDays * 22; // 22pxはセル幅を考慮した値

        // タスクバーの幅を計算
        const barDueDate = dueDate > maxDate ? maxDate : dueDate;
        const duration = (barDueDate - barStartDate) / (1000 * 60 * 60 * 24) + 1;
        const barWidth = duration * 22;

        const bar = document.createElement('div');
        bar.classList.add('gantt-bar');
        bar.style.left = `${offset}px`;
        bar.style.width = `${barWidth}px`;

        if (task.status === '完了') {
            bar.classList.add('completed');
        } else {
            const workingDays = getWorkingDaysUntilOrPast(new Date(task.due_date));
            if (new Date(task.due_date) < today || workingDays <= 3) {
                bar.classList.add('overdue');
            }
        }
        
        barContainer.appendChild(bar);
        barRow.innerHTML = `<div class="gantt-label">${task.name}</div>`;
        barRow.appendChild(barContainer);
        container.appendChild(barRow);
    });
}