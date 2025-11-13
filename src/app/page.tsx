'use client';
import { useState, useEffect } from 'react';

interface Region {
  id: number;
  name: string;
  target_range: string;
}

interface PivotData {
  equipment_name: string;
  central_count: number;
  northern_count: number;
  eastern_count: number;
  southern_count: number;
  em_count: number;
  grand_total: number;
}

interface NetworkRoute {
  id: number;
  node: string;
  ne_ip: string;
  idu: string;
  capacity: string;
  location: string;
  l3_port: string;
  hostname: string;
}

export default function RegionalDataManager() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [pivotData, setPivotData] = useState<PivotData[]>([]);
  const [networkRoutes, setNetworkRoutes] = useState<NetworkRoute[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'pivot' | 'data'>('upload');

  useEffect(() => {
    fetchRegions();
    fetchPivotData();
    fetchNetworkRoutes();
  }, []);

  const fetchRegions = async () => {
    try {
      const response = await fetch('/api/regions');
      const data = await response.json();
      setRegions(data);
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const fetchPivotData = async () => {
    try {
      const response = await fetch('/api/pivot');
      const data = await response.json();
      setPivotData(data);
    } catch (error) {
      console.error('Error fetching pivot data:', error);
    }
  };

  const fetchNetworkRoutes = async (region?: string) => {
    try {
      const url = region ? `/api/routes?region=${region}` : '/api/routes';
      const response = await fetch(url);
      const data = await response.json();
      setNetworkRoutes(data);
    } catch (error) {
      console.error('Error fetching network routes:', error);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedRegion) {
      setMessage('Please select both a region and a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('regionId', selectedRegion);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        const regionName = regions.find(r => r.id.toString() === selectedRegion)?.name;
        setMessage(`Sheet ${regionName} Updated with new Data COMPLETE - ${result.recordsProcessed} routes imported`);
        fetchPivotData();
        fetchNetworkRoutes();
      } else {
        setMessage(result.error || 'Upload failed');
      }
    } catch (error) {
      setMessage('Upload failed');
    }
  };

  const combineAllData = async () => {
    try {
      const response = await fetch('/api/combine', {
        method: 'POST',
      });
      const result = await response.json();
      if (response.ok) {
        setMessage('All Region Data combined successfully. Updated COMPLETE.');
        fetchPivotData();
        fetchNetworkRoutes();
      } else {
        setMessage(result.error || 'Combination failed');
      }
    } catch (error) {
      setMessage('Combination failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Network Route Data Manager
        </h1>
        <p className="text-gray-600 mb-8">L3 Port Management System</p>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-md ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Data Import
          </button>
          <button
            onClick={() => setActiveTab('pivot')}
            className={`px-4 py-2 rounded-md ${
              activeTab === 'pivot'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Capacity Summary
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 rounded-md ${
              activeTab === 'data'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Network Routes
          </button>
        </div>

        {activeTab === 'upload' && (
          <>
            {/* File Upload Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Import Regional Data</h2>
              
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Region
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a region</option>
                    {regions.map(region => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Network Route Excel File
                  </label>
                  <input
                    type="file"
                    accept=".xls,.xlsx,.xlsm"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    File should contain network route data with columns: Node, NE_IP, IDU, Capacity, etc.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Import Data
                </button>
              </form>
            </div>

            {/* Combine Data Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Combine All Data</h2>
              <button
                onClick={combineAllData}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Combine All Regional Data
              </button>
            </div>
          </>
        )}

        {activeTab === 'pivot' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Capacity Type Summary</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Capacity Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Central
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Northern
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Eastern
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Southern
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      EM
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grand Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pivotData.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.equipment_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {row.central_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {row.northern_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {row.eastern_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {row.southern_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {row.em_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                        {row.grand_total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Network Routes</h2>
              <select 
                onChange={(e) => fetchNetworkRoutes(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Regions</option>
                {regions.map(region => (
                  <option key={region.id} value={region.name}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NE IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IDU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L3 Port</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hostname</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {networkRoutes.map((route, index) => (
                    <tr key={route.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{route.node}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{route.ne_ip}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{route.idu}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{route.capacity}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{route.location}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{route.l3_port}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{route.hostname}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}