// water.js
const water = {
    // Variables for pagination
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    allData: [],
    chartInstance: null, // Added for Chart.js instance

    // WATER FUNCTIONALITY
    async loadWaterData() {
        try {
            showWaterLoading();
            const response = await fetch(`${API_BASE_URL}/water`, { headers: authHeaders() });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const waterData = await response.json();
            this.displayWaterData(waterData);
            this.setupChart(waterData); // Setup chart after data is loaded
            hideWaterLoading();

        } catch (error) {
            console.error('Error loading water data:', error);
            showError('Failed to load water data. Please check if the server is running on port 2992.');
            hideWaterLoading();
        }
    },

    displayWaterData(waterData) {
        this.allData = waterData;
        this.totalItems = waterData.length;

        const tableBody = document.getElementById('waterTableBody');
        const table = document.getElementById('waterTable');
        const pagination = document.getElementById('waterPagination');

        tableBody.innerHTML = '';

        if (waterData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No water readings found. Add your first reading!</td></tr>';
            pagination.classList.add('hidden');
        } else {
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = Math.min(startIndex + this.pageSize, waterData.length);
            const pageData = waterData.slice(startIndex, endIndex);

            pageData.forEach(reading => {
                const row = this.createWaterRow(reading);
                tableBody.appendChild(row);
            });

            this.updatePagination();
            pagination.classList.remove('hidden');
        }

        table.classList.remove('hidden');
    },

    createWaterRow(reading) {
        const row = document.createElement('tr');
        const consumptionClass = reading.kulutus_vesi > 0 ? 'consumption-highlight-water' : '';
        
        // Sanitize the description string before passing it to showDeleteModal
        const deleteDescription = escapeHtml(`${reading.kiinteisto || reading.kiinteistotunnus} - ${reading.kuukausi} ${reading.vuosi}`);

        row.innerHTML = `
            <td>${reading.kiinteisto || reading.kiinteistotunnus}${reading.mittarinvaihto ? '<span style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-size:0.72rem;padding:1px 7px;border-radius:50px;font-weight:600;margin-left:4px">🔄 Vaihto</span>' : ''}</td>
            <td>${reading.osoite || '-'}</td>
            <td>${reading.vuosi}</td>
            <td>${reading.kuukausi}</td>
            <td>${new Date(reading.lukemapva).toLocaleDateString('fi-FI')}</td>
            <td>${reading.vesilukema} m³${reading.mittarinvaihto ? '<br><small style="color:var(--text-3)">Vanha: ' + reading.vanha_lukema + ' m³</small>' : ''}</td>
            <td><span class="${consumptionClass}">${reading.kulutus_vesi > 0 ? reading.kulutus_vesi + ' m³' : '-'}</span></td>
            <td>${reading.muuta || '-'}</td>
            <td class="actions-cell">
                <button onclick="water.editWaterReading(${reading.id})" class="success">✏️ Edit</button>
                <button onclick="showDeleteModal('water', ${reading.id}, '${reading.kiinteisto || reading.kiinteistotunnus} - ${reading.kuukausi} ${reading.vuosi}')" class="danger">🗑️ Delete</button>
            </td>
        `;
        return row;
    },

    async loadPropertiesForSelect() {
        try {
            const response = await fetch(`${API_BASE_URL}/property`, { headers: authHeaders() });
            const properties = await response.json();

            const select = document.getElementById('water_kiinteistotunnus');
            select.innerHTML = '<option value="">Select Property...</option>';

            properties.forEach(property => {
                const option = document.createElement('option');
                option.value = property.kiinteistotunnus;
                option.textContent = `${property.kiinteisto || property.kiinteistotunnus} - ${property.osoite}`;
                select.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading properties for water select:', error);
        }
    },

    showAddWaterForm() {
        document.getElementById('addWaterForm').classList.remove('hidden');
        document.getElementById('waterForm').reset();
        currentEditId = null;
        document.querySelector('#addWaterForm h2').textContent = 'Add Water Reading';
        document.querySelector('#addWaterForm button[type="submit"]').innerHTML = '💾 Save Reading';
        document.getElementById('water_vuosi').value = new Date().getFullYear();
        this.toggleMeterChangeFields();
    },

    hideAddWaterForm() {
        document.getElementById('addWaterForm').classList.add('hidden');
        document.getElementById('waterForm').reset();
        currentEditId = null;
        // Reset form title and button text to default state
        document.querySelector('#addWaterForm h2').textContent = 'Add Water Reading';
        document.querySelector('#addWaterForm button[type="submit"]').innerHTML = '💾 Save Reading';
        this.toggleMeterChangeFields();
    },

    toggleMeterChangeFields() {
        const cb     = document.getElementById('water_mittarinvaihto');
        const fields = document.getElementById('waterMeterChangeFields');
        if (!cb || !fields) return;
        fields.style.display = cb.checked ? 'block' : 'none';
        if (!cb.checked) {
            const v = document.getElementById('water_vanha_lukema');
            if (v) v.value = '';
        }
    },

    async editWaterReading(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/water`, { headers: authHeaders() });
            const waterData = await response.json();
            const reading = waterData.find(r => r.id === id);

            if (reading) {
                await this.loadPropertiesForSelect();
                document.getElementById('water_kiinteistotunnus').value = reading.kiinteistotunnus;
                document.getElementById('water_vuosi').value = reading.vuosi;
                document.getElementById('water_kuukausi').value = reading.kuukausi;
                document.getElementById('water_lukemapva').value = reading.lukemapva;
                document.getElementById('water_vesilukema').value = reading.vesilukema;
                document.getElementById('water_muuta').value = reading.muuta || '';

                const cb = document.getElementById('water_mittarinvaihto');
                if (cb) {
                    cb.checked = !!reading.mittarinvaihto;
                    this.toggleMeterChangeFields();
                    if (reading.mittarinvaihto && reading.vanha_lukema !== null) {
                        document.getElementById('water_vanha_lukema').value = reading.vanha_lukema;
                    }
                }

                currentEditId = id;
                document.querySelector('#addWaterForm h2').textContent = 'Edit Water Reading';
                document.querySelector('#addWaterForm button[type="submit"]').innerHTML = '✏️ Update Reading';
                document.getElementById('addWaterForm').classList.remove('hidden');
                document.getElementById('addWaterForm').scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error loading water reading for edit:', error);
            showError('Failed to load water reading data for editing');
        }
    },

    async handleWaterFormSubmit() {
        const formData = new FormData(document.getElementById('waterForm'));
        const waterData = {};

        for (let [key, value] of formData.entries()) {
            if (key === 'vesilukema' || key === 'vanha_lukema') {
                waterData[key] = value !== '' ? parseFloat(value) : null;
            } else if (key === 'vuosi') {
                waterData[key] = parseInt(value);
            } else {
                waterData[key] = value || null;
            }
        }
        const cb = document.getElementById('water_mittarinvaihto');
        waterData.mittarinvaihto = cb && cb.checked ? 1 : 0;
        if (waterData.mittarinvaihto && !waterData.vanha_lukema) {
            showError('Mittarinvaihdossa vanhan mittarin lukema on pakollinen.');
            return;
        }

        try {
            let response;
            if (currentEditId) {
                response = await fetch(`${API_BASE_URL}/water/${currentEditId}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify(waterData)
                });
            } else {
                response = await fetch(`${API_BASE_URL}/water`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(waterData)
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save water reading');
            }

            showSuccess(currentEditId ? 'Water reading updated successfully!' : 'Water reading added successfully!');
            this.hideAddWaterForm();
            this.loadWaterData();

        } catch (error) {
            console.error('Error saving water reading:', error);
            showError(error.message);
        }
    },

    async exportWaterToCsv() {
        try {
            const response = await fetch(`${API_BASE_URL}/water`, { headers: authHeaders() });
            const waterData = await response.json();

            if (waterData.length === 0) {
                showError('No water data to export');
                return;
            }

            // Create CSV headers
            const headers = [
                'Property', 'Address', 'Property ID', 'Year', 'Month', 'Reading Date',
                'Water Reading (m³)', 'Water Consumption (m³)', 'Meter Change', 'Old Water Reading (m³)', 'Notes'
            ];

            // Convert data to CSV format
            const csvContent = [
                headers.join(','),
                ...waterData.map(reading => [
                    `"${reading.kiinteisto || reading.kiinteistotunnus || ''}"`,
                    `"${reading.osoite || ''}"`,
                    `"${reading.kiinteistotunnus || ''}"`,
                    reading.vuosi || '',
                    `"${reading.kuukausi || ''}"`,
                    reading.lukemapva ? new Date(reading.lukemapva).toLocaleDateString('fi-FI') : '',
                    reading.vesilukema || '',
                    reading.kulutus_vesi || '',
                    reading.mittarinvaihto ? 'Kyllä' : '',
                    reading.vanha_lukema || '',
                    `"${reading.muuta || ''}"`
                ].join(','))
            ].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `water_consumption_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSuccess('Water consumption data exported successfully!');
        } catch (error) {
            console.error('Error exporting water data:', error);
            showError('Failed to export water consumption data');
        }
    },

    // CHART FUNCTIONALITY
    setupChart(waterData) {
        this.populateYearSelectors(waterData);
        this.createChart(waterData);
    },

    populateYearSelectors(waterData) {
        const years = [...new Set(waterData.map(item => item.vuosi))].sort((a, b) => b - a);
        const currentYear = new Date().getFullYear();

        const yearSelect = document.getElementById('water-year-select');
        yearSelect.innerHTML = '';

        // Add options for each year to the multi-select dropdown
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            // Select current year by default if available, otherwise select the latest year
            if (year === currentYear || (years.length > 0 && year === years[0])) { // Select the latest year if currentYear not found
                option.selected = true;
            }
            yearSelect.appendChild(option);
        });

        // Add event listeners
        yearSelect.removeEventListener('change', this.handleChartControlChange);
        yearSelect.addEventListener('change', this.handleChartControlChange.bind(this, waterData));

    },

    handleChartControlChange(waterData) {
        const yearSelect = document.getElementById('water-year-select');
        const selectedOptions = Array.from(yearSelect.selectedOptions);
        const selectedYears = selectedOptions.map(option => parseInt(option.value));
        
        this.updateChart(waterData, selectedYears);
    },

    createChart(waterData) {
        const ctx = document.getElementById('waterChart').getContext('2d');

        // Destroy existing chart if it exists
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Get initial selected years (the ones populated by populateYearSelectors)
        const yearSelect = document.getElementById('water-year-select');
        const selectedOptions = Array.from(yearSelect.selectedOptions);
        const selectedYears = selectedOptions.map(option => parseInt(option.value));

        const chartData = this.prepareChartData(waterData, selectedYears);

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Water Consumption - ${selectedYears.length > 1 ? 'Years ' + selectedYears.join(', ') : (selectedYears[0] || 'No Year Selected')}`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Consumption (m³)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    }
                }
            }
        });
    },

    prepareChartData(waterData, selectedYears) {
        const months = ['Tammi', 'Helmi', 'Maalis', 'Huhti', 'Touko', 'Kesä',
                       'Heinä', 'Elo', 'Syys', 'Loka', 'Marras', 'Joulu'];
        const datasets = [];
//        const showFlow = document.getElementById('showFlowConsumption').checked;

        // Define a set of consistent colors for years
        const colors = [
            'rgba(255, 99, 132, 0.6)', // Red
            'rgba(54, 162, 235, 0.6)', // Blue
            'rgba(255, 206, 86, 0.6)', // Yellow
            'rgba(75, 192, 192, 0.6)', // Green
            'rgba(153, 102, 255, 0.6)',// Purple
            'rgba(255, 159, 64, 0.6)', // Orange
            'rgba(199, 199, 199, 0.6)',// Grey
            'rgba(83, 102, 134, 0.6)', // Dark Blue Grey
            'rgba(110, 203, 110, 0.6)',// Light Green
            'rgba(200, 50, 50, 0.6)',  // Dark Red
        ];
        const borderColors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)',
            'rgba(83, 102, 134, 1)',
            'rgba(110, 203, 110, 1)',
            'rgba(200, 50, 50, 1)',
        ];

        selectedYears.sort((a, b) => a - b); // Sort years for consistent color assignment

        selectedYears.forEach((year, index) => {
            const yearData = this.getYearlyData(waterData, year, months);
            const colorIndex = index % colors.length; // Cycle through colors

            datasets.push({
                label: `${year} - Water (m³)`,
                data: yearData.water,
                backgroundColor: colors[colorIndex],
                borderColor: borderColors[colorIndex],
                borderWidth: 1,
                // Add a unique ID to distinguish water/flow for a given year if needed for complex interactions
                // type: 'bar' // Explicitly set type if mixing types later
            });
        });

        return {
            labels: months,
            datasets: datasets
        };
    },

    getYearlyData(waterData, year, months) {
        const waterConsumption = new Array(12).fill(0);

        // Filter data for the specific year and aggregate by month
        const yearData = waterData.filter(item => item.vuosi === year);

        yearData.forEach(item => {
            // Find month index using item.kuukausi (e.g., "Tammi") against the months array
            // Note: Your data uses Finnish month names. Ensure they match the 'months' array.
            const monthIndex = months.indexOf(item.kuukausi);
            if (monthIndex !== -1) {
                waterConsumption[monthIndex] += item.kulutus_vesi || 0;
            }
        });

        return {
            water: waterConsumption,
        };
    },

    updateChart(waterData, selectedYears) {
        if (!this.chartInstance) return;

        // Update chart title based on selected years
        const titleText = selectedYears.length > 0
            ? `Water Consumption - Years: ${selectedYears.join(', ')}`
            : 'Water Consumption';

        this.chartInstance.options.plugins.title.text = titleText;

        const newData = this.prepareChartData(waterData, selectedYears);
        this.chartInstance.data = newData;
        this.chartInstance.update();
    },

    // PAGINATION FUNCTIONS
    updatePagination() {
        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);

        const currentRangeSpan = document.getElementById('waterCurrentRange');
        const totalItemsSpan = document.getElementById('waterTotalItems');
        const prevBtn = document.getElementById('waterPrevBtn');
        const nextBtn = document.getElementById('waterNextBtn');
        const pageNumbersDiv = document.getElementById('waterPageNumbers');
        const pageSizeSelect = document.getElementById('waterPageSize');

        if (!currentRangeSpan || !totalItemsSpan || !prevBtn || !nextBtn || !pageNumbersDiv || !pageSizeSelect) {
            console.error('Error: Missing pagination elements for water.');
            return;
        }

        currentRangeSpan.textContent = `${startItem}-${endItem}`;
        totalItemsSpan.textContent = this.totalItems;

        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;

        this.updatePageNumbers(totalPages);
    },

    updatePageNumbers(totalPages) {
        const pageNumbers = document.getElementById('waterPageNumbers'); // Corrected ID
        if (!pageNumbers) {
            console.error('Error: waterPageNumbers element not found.');
            return;
        }
        let html = '';

        for (let i = 1; i <= totalPages; i++) {
            // Logic for pagination buttons (first, last, current +/- 2, ellipsis)
            if (i === this.currentPage) {
                html += `<button class="page-number active" onclick="water.goToPage(${i})">${i}</button>`;
            } else if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `<button class="page-number" onclick="water.goToPage(${i})">${i}</button>`;
            } else if (
                (i === this.currentPage - 3 && this.currentPage - 3 > 1) || 
                (i === this.currentPage + 3 && this.currentPage + 3 < totalPages)
            ) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }

        pageNumbers.innerHTML = html;
    },

    changePage(direction) {
        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        this.currentPage = Math.max(1, Math.min(totalPages, this.currentPage + direction));
        this.displayWaterData(this.allData);
    },

    goToPage(page) {
        this.currentPage = page;
        this.displayWaterData(this.allData);
    },

    changePageSize() {
        const pageSizeSelect = document.getElementById('waterPageSize');
        if (!pageSizeSelect) {
            console.error('Error: waterPageSize element not found.');
            return;
        }
        this.pageSize = parseInt(pageSizeSelect.value); // Corrected ID
        this.currentPage = 1;
        this.displayWaterData(this.allData);
    }
};

// Global functions for HTML onclick handlers (ensure they point to water)
function showAddWaterForm() {
    water.showAddWaterForm();
}

function hideAddWaterForm() {
    water.hideAddWaterForm();
}

function loadWaterData() {
    water.loadWaterData();
}

function exportWaterToCsv() {
    water.exportWaterToCsv();
}

function changeWaterPage(direction) {
    water.changePage(direction);
}

function changeWaterPageSize() {
    water.changePageSize();
}

// Make sure the water object is globally accessible
window.water = water;
