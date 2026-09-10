// property.js
const property = {
    // PROPERTIES FUNCTIONALITY
    async loadProperties() {
        try {
            showPropertiesLoading();
            const response = await fetch(`${API_BASE_URL}/property`, { headers: authHeaders() });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const properties = await response.json();
            this.displayProperties(properties);
            hidePropertiesLoading();

        } catch (error) {
            console.error('Error loading properties:', error);
            showError('Failed to load properties. Please check if the server is running on port 2992.');
            hidePropertiesLoading();
        }
    },

    displayProperties(properties) {
        const tableBody = document.getElementById('propertiesTableBody');
        const table = document.getElementById('propertiesTable');

        tableBody.innerHTML = '';

        if (properties.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">No properties found. Add your first property!</td></tr>';
        } else {
            properties.forEach(property => {
                const row = this.createPropertyRow(property);
                tableBody.appendChild(row);
            });
        }

        table.classList.remove('hidden');
    },

    createPropertyRow(property) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${property.kiinteisto || '-'}</td>
            <td>${property.osoite}</td>
            <td>${property.kiinteistotunnus}</td>
            <td>${property.rakennusvuosi || '-'}</td>
            <td>${property.rakennusmateriaali || '-'}</td>
            <td>${property.pintaala ? property.pintaala + ' m²' : '-'}</td>
            <td>${property.tilavuus ? property.tilavuus + ' m³' : '-'}</td>
            <td>${property.tontinpintaala ? property.tontinpintaala + ' m²' : '-'}</td>
            <td>${property.omistajanimi}</td>
            <td>${property.omistajapuh || '-'}</td>
            <td>${property.omistajasposti || '-'}</td>
            <td>${property.muuta || '-'}</td>
            <td class="actions-cell">
                <button onclick="property.editProperty('${property.kiinteistotunnus}')" class="success">✏️ Edit</button>
                <button onclick="showDeleteModal('property', '${property.kiinteistotunnus}', '${property.osoite}')" class="danger">🗑️ Delete</button>
            </td>
        `;
        return row;
    },

    showAddPropertyForm() {
        document.getElementById('addPropertyForm').classList.remove('hidden');
        document.getElementById('propertyForm').reset();
        currentEditId = null;
        document.querySelector('#addPropertyForm h2').textContent = 'Add New Property';
        document.querySelector('#addPropertyForm button[type="submit"]').innerHTML = '💾 Save Property';
    },

    hideAddPropertyForm() {
        document.getElementById('addPropertyForm').classList.add('hidden');
        currentEditId = null;
    },

    async editProperty(kiinteistotunnus) {
        try {
            const response = await fetch(`${API_BASE_URL}/property`, { headers: authHeaders() });
            const properties = await response.json();
            const property = properties.find(p => p.kiinteistotunnus === kiinteistotunnus);

            if (property) {
                Object.keys(property).forEach(key => {
                    const input = document.getElementById(key);
                    if (input) {
                        input.value = property[key] || '';
                    }
                });

                currentEditId = kiinteistotunnus;
                document.querySelector('#addPropertyForm h2').textContent = 'Edit Property';
                document.querySelector('#addPropertyForm button[type="submit"]').innerHTML = '✏️ Update Property';
                document.getElementById('addPropertyForm').classList.remove('hidden');
                document.getElementById('addPropertyForm').scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error loading property for edit:', error);
            showError('Failed to load property data for editing');
        }
    },

    async handlePropertyFormSubmit() {
        const formData = new FormData(document.getElementById('propertyForm'));
        const propertyData = {};

        for (let [key, value] of formData.entries()) {
            propertyData[key] = value || null;
        }

        try {
            let response;
            if (currentEditId) {
                response = await fetch(`${API_BASE_URL}/property/${currentEditId}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify(propertyData)
                });
            } else {
                response = await fetch(`${API_BASE_URL}/property`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(propertyData)
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save property');
            }

            showSuccess(currentEditId ? 'Property updated successfully!' : 'Property added successfully!');
            this.hideAddPropertyForm();
            this.loadProperties();

        } catch (error) {
            console.error('Error saving property:', error);
            showError(error.message);
        }
    },

    async exportPropertiesToCsv() {
        try {
            const response = await fetch(`${API_BASE_URL}/property`, { headers: authHeaders() });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const properties = await response.json();

            if (properties.length === 0) {
                showError('No property data to export.');
                return;
            }

            // Define CSV headers (order them as desired for the CSV file)
            const headers = [
                'Property ID',
                'Property Name',
                'Property Owner',
                'Address',
                'Building Year',
                'Building Material',
                'Area (m²)',
                'Volume (m³)',
                'Plot Area (m²)',
                'Owner Phone',
                'Owner Email',
                'Other information'                
            ];

            // Map data to CSV rows, ensuring correct order and handling missing data
            const rows = properties.map(p => [
                `"${p.kiinteistotunnus || ''}"`, // Enclose in quotes to handle commas
                `"${p.kiinteisto || ''}"`,
                `"${p.omistajanimi || ''}"`,
                `"${p.osoite || ''}"`,
                `"${p.rakennusvuosi || ''}"`,
                `"${p.rakennusmateriaali || ''}"`,
                `"${p.pintaala || ''}"`,
                `"${p.tilavuus || ''}"`,
                `"${p.tontinpintaala || ''}"`,
                `"${p.omistajapuh || ''}"`,
                `"${p.omistajasposti || ''}"`,
                `"${p.muuta || ''}"`
            ]);

            // Combine headers and rows
            const csvContent = [
                headers.join(','), // Join headers with comma
                ...rows.map(row => row.join(',')) // Join each row's data with comma
            ].join('\n'); // Join all lines with a newline

            // Create a Blob containing the CSV data
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            
            // Create a link element and trigger the download
            const link = document.createElement('a');
            if (link.download !== undefined) { // Feature detection for download attribute
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'properties_export.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showSuccess('Property data exported successfully!');
            } else {
                // Fallback for browsers that don't support the download attribute
                window.open(encodeURI('data:text/csv;charset=utf-8,' + csvContent));
            }

        } catch (error) {
            console.error('Error exporting properties to CSV:', error);
            showError('Failed to export properties data.');
        }
    }
    
};
