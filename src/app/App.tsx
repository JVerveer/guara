import { useState } from 'react';
import { Shield, Upload, Building2, AlertTriangle, CheckCircle2, TrendingUp, XCircle, LayoutDashboard, FileText, Target, Activity, Package, Settings, Clock, FileCheck, Users, BarChart3, ChevronRight, Download, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'upload', icon: Upload, label: 'Upload Center' },
    { id: 'vendors', icon: Building2, label: 'Vendor Inventory' },
    { id: 'critical', icon: Shield, label: 'Critical Vendors' },
    { id: 'gaps', icon: AlertTriangle, label: 'Gap Analysis' },
    { id: 'audit', icon: Package, label: 'Audit Package' },
  ];

  return (
    <div className="flex h-screen bg-[#FAFBFC]">
      {/* Sidebar */}
      <aside className="w-[260px] bg-white border-r border-[#E5E7EB] flex flex-col shadow-sm">
        <div className="p-6 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold text-[#111827]">VendorLens AI</h1>
              <p className="text-[11px] text-[#6B7280]">DORA Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="mb-4">
            <p className="px-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Main</p>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 transition-all text-[14px] ${
                  activeTab === item.id
                    ? 'bg-[#EFF6FF] text-[#2563EB] font-medium shadow-sm'
                    : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
                }`}
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-[#E5E7EB]">
          <div className="bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-lg p-4 border border-[#BFDBFE]">
            <p className="text-[12px] font-semibold text-[#1E3A8A] mb-1">Audit Ready</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-[24px] font-bold text-[#2563EB]">82</span>
              <span className="text-[14px] text-[#6B7280]">/100</span>
            </div>
            <div className="w-full bg-white rounded-full h-1.5">
              <div className="bg-gradient-to-r from-[#2563EB] to-[#3B82F6] h-1.5 rounded-full" style={{ width: '82%' }} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'upload' && <UploadCenter />}
        {activeTab === 'vendors' && <VendorInventory />}
        {activeTab === 'critical' && <CriticalVendors />}
        {activeTab === 'gaps' && <GapAnalysis />}
        {activeTab === 'audit' && <AuditPackage />}
      </main>
    </div>
  );
}

function StatCard({ title, value, subtitle, trend, icon: Icon, color = 'blue' }: any) {
  const colors = {
    blue: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', icon: 'text-[#3B82F6]' },
    green: { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', icon: 'text-[#22C55E]' },
    amber: { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', icon: 'text-[#F59E0B]' },
    red: { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', icon: 'text-[#EF4444]' },
    purple: { bg: 'bg-[#F5F3FF]', text: 'text-[#7C3AED]', icon: 'text-[#8B5CF6]' },
  };

  const c = colors[color as keyof typeof colors];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-lg hover:border-[#D1D5DB] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 ${c.bg} rounded-lg`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[12px] font-medium ${trend > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mb-1">
        <h3 className={`text-[28px] font-bold ${c.text}`}>{value}</h3>
      </div>
      <p className="text-[13px] font-medium text-[#111827] mb-0.5">{title}</p>
      {subtitle && <p className="text-[12px] text-[#6B7280]">{subtitle}</p>}
    </div>
  );
}

function Dashboard() {
  return (
    <div className="p-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-[32px] font-bold text-[#111827] mb-1">DORA Compliance Overview</h1>
              <p className="text-[14px] text-[#6B7280]">Real-time vendor risk and regulatory compliance status</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#374151] rounded-lg text-[14px] font-medium hover:bg-[#F9FAFB] flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Report
              </button>
              <button className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[14px] font-medium hover:bg-[#1D4ED8] flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Documents
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
            <Clock className="w-4 h-4" />
            Last updated: June 9, 2026 at 10:32 AM
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatCard
            title="ICT Register"
            value="143"
            subtitle="Active vendors"
            icon={FileText}
            color="blue"
            trend={12}
          />
          <StatCard
            title="Critical Vendor Inventory"
            value="17"
            subtitle="Require enhanced oversight"
            icon={Shield}
            color="amber"
          />
          <StatCard
            title="Risk Assessments"
            value="143"
            subtitle="100% coverage"
            icon={BarChart3}
            color="green"
            trend={8}
          />
          <StatCard
            title="Evidence Inventory"
            value="87"
            subtitle="Documents on file"
            icon={FileCheck}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatCard
            title="Concentration Risk Report"
            value="3"
            subtitle="High-risk dependencies"
            icon={Target}
            color="red"
          />
          <StatCard
            title="Gap Report"
            value="8"
            subtitle="Open compliance gaps"
            icon={AlertTriangle}
            color="amber"
          />
          <StatCard
            title="Remediation Plan"
            value="24"
            subtitle="Action items tracked"
            icon={CheckCircle2}
            color="blue"
          />
          <StatCard
            title="Review History"
            value="89"
            subtitle="Completed this year"
            icon={Clock}
            color="green"
            trend={15}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Risk Matrix */}
          <div className="col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[18px] font-semibold text-[#111827]">Risk Distribution</h2>
                <p className="text-[13px] text-[#6B7280]">Vendors by risk level</p>
              </div>
              <button className="text-[13px] text-[#2563EB] font-medium hover:text-[#1D4ED8] flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2] rounded-lg p-4 border border-[#FECACA]">
                <div className="text-[32px] font-bold text-[#DC2626] mb-1">5</div>
                <div className="text-[13px] font-medium text-[#991B1B]">Critical Risk</div>
                <div className="text-[12px] text-[#991B1B] opacity-75">3.5% of total</div>
              </div>
              <div className="bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] rounded-lg p-4 border border-[#FDE68A]">
                <div className="text-[32px] font-bold text-[#D97706] mb-1">12</div>
                <div className="text-[13px] font-medium text-[#92400E]">High Risk</div>
                <div className="text-[12px] text-[#92400E] opacity-75">8.4% of total</div>
              </div>
              <div className="bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-lg p-4 border border-[#BFDBFE]">
                <div className="text-[32px] font-bold text-[#2563EB] mb-1">48</div>
                <div className="text-[13px] font-medium text-[#1E3A8A]">Medium Risk</div>
                <div className="text-[12px] text-[#1E3A8A] opacity-75">33.6% of total</div>
              </div>
              <div className="bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] rounded-lg p-4 border border-[#BBF7D0]">
                <div className="text-[32px] font-bold text-[#16A34A] mb-1">78</div>
                <div className="text-[13px] font-medium text-[#166534]">Low Risk</div>
                <div className="text-[12px] text-[#166534] opacity-75">54.5% of total</div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-medium text-[#6B7280]">Overall Risk Score</span>
                <span className="text-[14px] font-bold text-[#F59E0B]">58/100</span>
              </div>
              <div className="w-full bg-[#F3F4F6] rounded-full h-2">
                <div className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] h-2 rounded-full" style={{ width: '58%' }} />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-[18px] font-semibold text-[#111827] mb-4">Priority Actions</h2>
            <div className="space-y-3">
              <ActionItem
                title="Review 5 expiring SOC2 reports"
                subtitle="Due in 30 days"
                severity="high"
              />
              <ActionItem
                title="Update 7 exit strategies"
                subtitle="DORA requirement"
                severity="high"
              />
              <ActionItem
                title="Complete 12 vendor reviews"
                subtitle="Annual assessment overdue"
                severity="medium"
              />
              <ActionItem
                title="Request AWS BCP test results"
                subtitle="Missing evidence"
                severity="medium"
              />
              <ActionItem
                title="Diversify payment providers"
                subtitle="Concentration risk"
                severity="low"
              />
            </div>
          </div>
        </div>

        {/* Critical Vendors & Compliance Status */}
        <div className="grid grid-cols-2 gap-6">
          {/* Critical Vendors */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[18px] font-semibold text-[#111827]">Critical Vendors</h2>
                <p className="text-[13px] text-[#6B7280]">Require enhanced monitoring</p>
              </div>
              <button className="text-[13px] text-[#2563EB] font-medium hover:text-[#1D4ED8]">View all</button>
            </div>
            <div className="space-y-3">
              <VendorRow name="AWS" service="Cloud Infrastructure" risk={82} criticality="critical" />
              <VendorRow name="Stripe" service="Payment Processing" risk={76} criticality="critical" />
              <VendorRow name="Salesforce" service="CRM Platform" risk={65} criticality="critical" />
              <VendorRow name="Auth0" service="Authentication" risk={75} criticality="critical" />
              <VendorRow name="Datadog" service="Monitoring" risk={58} criticality="high" />
            </div>
          </div>

          {/* Compliance Status */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[18px] font-semibold text-[#111827]">DORA Compliance Status</h2>
                <p className="text-[13px] text-[#6B7280]">Regulatory requirements</p>
              </div>
            </div>
            <div className="space-y-4">
              <ComplianceRow title="ICT Register Completeness" percentage={95} status="excellent" />
              <ComplianceRow title="Exit Strategy Coverage" percentage={58} status="warning" />
              <ComplianceRow title="Evidence Documentation" percentage={72} status="good" />
              <ComplianceRow title="Vendor Review Currency" percentage={65} status="good" />
              <ComplianceRow title="Incident Response Plans" percentage={42} status="warning" />
              <ComplianceRow title="Subcontractor Disclosure" percentage={88} status="excellent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionItem({ title, subtitle, severity }: any) {
  const colors = {
    high: 'border-l-[#DC2626] bg-[#FEF2F2]',
    medium: 'border-l-[#F59E0B] bg-[#FFFBEB]',
    low: 'border-l-[#2563EB] bg-[#EFF6FF]',
  };

  return (
    <div className={`border-l-4 ${colors[severity]} rounded-r-lg p-3 hover:shadow-md transition-all cursor-pointer`}>
      <p className="text-[13px] font-medium text-[#111827] mb-0.5">{title}</p>
      <p className="text-[12px] text-[#6B7280]">{subtitle}</p>
    </div>
  );
}

function VendorRow({ name, service, risk, criticality }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg hover:bg-[#F3F4F6] transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${criticality === 'critical' ? 'bg-[#DC2626]' : 'bg-[#F59E0B]'}`} />
        <div>
          <p className="text-[13px] font-semibold text-[#111827]">{name}</p>
          <p className="text-[12px] text-[#6B7280]">{service}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[14px] font-bold ${risk > 70 ? 'text-[#DC2626]' : 'text-[#F59E0B]'}`}>{risk}</span>
        <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
      </div>
    </div>
  );
}

function ComplianceRow({ title, percentage, status }: any) {
  const colors = {
    excellent: 'bg-[#22C55E]',
    good: 'bg-[#3B82F6]',
    warning: 'bg-[#F59E0B]',
    poor: 'bg-[#EF4444]',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-[#111827]">{title}</span>
        <span className="text-[13px] font-bold text-[#111827]">{percentage}%</span>
      </div>
      <div className="w-full bg-[#E5E7EB] rounded-full h-2">
        <div className={`${colors[status]} h-2 rounded-full transition-all`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function UploadCenter() {
  return (
    <div className="p-8">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-[#111827] mb-2">Document Upload Center</h1>
          <p className="text-[14px] text-[#6B7280]">
            Upload vendor documents to automatically generate DORA-compliant risk assessments
          </p>
        </div>

        <div className="bg-white rounded-xl border-2 border-dashed border-[#D1D5DB] p-16 mb-8 text-center hover:border-[#2563EB] hover:bg-[#F9FAFB] transition-all cursor-pointer">
          <div className="w-16 h-16 bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-[#2563EB]" />
          </div>
          <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Drag and drop files here</h3>
          <p className="text-[14px] text-[#6B7280] mb-4">or click to browse from your computer</p>
          <div className="flex gap-2 justify-center flex-wrap text-[12px] text-[#9CA3AF]">
            <span className="px-3 py-1 bg-[#F3F4F6] rounded-full">PDF</span>
            <span className="px-3 py-1 bg-[#F3F4F6] rounded-full">DOCX</span>
            <span className="px-3 py-1 bg-[#F3F4F6] rounded-full">XLSX</span>
            <span className="px-3 py-1 bg-[#F3F4F6] rounded-full">CSV</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5 mb-8">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 text-center">
            <div className="text-[32px] font-bold text-[#2563EB] mb-1">87</div>
            <div className="text-[13px] font-medium text-[#111827]">Documents Uploaded</div>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 text-center">
            <div className="text-[32px] font-bold text-[#16A34A] mb-1">143</div>
            <div className="text-[13px] font-medium text-[#111827]">Vendors Identified</div>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 text-center">
            <div className="text-[32px] font-bold text-[#F59E0B] mb-1">95%</div>
            <div className="text-[13px] font-medium text-[#111827]">Processing Accuracy</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="flex-1 px-6 py-3 bg-[#2563EB] text-white rounded-lg font-medium hover:bg-[#1D4ED8] transition-colors shadow-sm">
            Generate Vendor Program
          </button>
          <button className="px-6 py-3 bg-white border border-[#E5E7EB] text-[#374151] rounded-lg font-medium hover:bg-[#F9FAFB] transition-colors">
            View Sample
          </button>
        </div>
      </div>
    </div>
  );
}

function VendorInventory() {
  const vendors = [
    { name: 'AWS', service: 'Cloud Infrastructure', criticality: 'Critical', risk: 82, status: 'Healthy', evidence: 95, review: '2026-05-15' },
    { name: 'Stripe', service: 'Payment Processing', criticality: 'Critical', risk: 76, status: 'Review Needed', evidence: 88, review: '2026-03-20' },
    { name: 'Salesforce', service: 'CRM Platform', criticality: 'Critical', risk: 65, status: 'Healthy', evidence: 92, review: '2026-06-01' },
    { name: 'Zendesk', service: 'Customer Support', criticality: 'Medium', risk: 35, status: 'Healthy', evidence: 85, review: '2026-04-10' },
    { name: 'Slack', service: 'Communication', criticality: 'Low', risk: 25, status: 'Healthy', evidence: 78, review: '2026-05-25' },
    { name: 'GitHub', service: 'Code Repository', criticality: 'High', risk: 55, status: 'Healthy', evidence: 90, review: '2026-04-15' },
    { name: 'Auth0', service: 'Authentication', criticality: 'Critical', risk: 75, status: 'Healthy', evidence: 94, review: '2026-05-30' },
  ];

  return (
    <div className="p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[32px] font-bold text-[#111827] mb-2">Vendor Inventory</h1>
          <p className="text-[14px] text-[#6B7280]">Comprehensive register of all third-party service providers</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-6 py-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Vendor</th>
                  <th className="text-left px-6 py-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Service</th>
                  <th className="text-left px-6 py-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Criticality</th>
                  <th className="text-left px-6 py-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Risk Score</th>
                  <th className="text-left px-6 py-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Evidence</th>
                  <th className="text-left px-6 py-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Last Review</th>
                  <th className="text-left px-6 py-4 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {vendors.map((vendor, idx) => (
                  <tr key={idx} className="hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-lg flex items-center justify-center">
                          <span className="text-[12px] font-bold text-[#2563EB]">{vendor.name[0]}</span>
                        </div>
                        <span className="text-[14px] font-semibold text-[#111827]">{vendor.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-[#6B7280]">{vendor.service}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                        vendor.criticality === 'Critical' ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]' :
                        vendor.criticality === 'High' ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]' :
                        vendor.criticality === 'Medium' ? 'bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]' :
                        'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                      }`}>
                        {vendor.criticality}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[14px] font-bold ${
                          vendor.risk > 70 ? 'text-[#DC2626]' : vendor.risk > 50 ? 'text-[#F59E0B]' : 'text-[#16A34A]'
                        }`}>
                          {vendor.risk}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-[#E5E7EB] rounded-full h-1.5">
                          <div className="bg-[#2563EB] h-1.5 rounded-full" style={{ width: `${vendor.evidence}%` }} />
                        </div>
                        <span className="text-[12px] font-medium text-[#6B7280]">{vendor.evidence}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-[#6B7280]">{vendor.review}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                        vendor.status === 'Healthy' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}>
                        {vendor.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CriticalVendors() {
  return (
    <div className="p-8">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-[32px] font-bold text-[#111827] mb-2">Critical Vendor Register</h1>
        <p className="text-[14px] text-[#6B7280] mb-8">DORA-identified critical ICT service providers requiring enhanced oversight</p>

        <div className="grid grid-cols-3 gap-5 mb-6">
          <StatCard title="Total Critical Vendors" value="17" subtitle="Require enhanced monitoring" icon={Shield} color="red" />
          <StatCard title="Exit Strategies" value="10" subtitle="7 pending documentation" icon={FileText} color="amber" />
          <StatCard title="Annual Reviews" value="12" subtitle="5 overdue" icon={Clock} color="blue" />
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 shadow-sm">
          <p className="text-[14px] text-[#6B7280]">17 critical vendors identified based on operational impact analysis and DORA criteria.</p>
        </div>
      </div>
    </div>
  );
}

function GapAnalysis() {
  const gaps = [
    {
      id: 'GAP-001',
      title: 'Missing Exit Strategy Documentation',
      severity: 'Critical',
      affected: 7,
      description: 'Seven critical vendors lack documented exit strategies as required by DORA Article 28.',
      recommendation: 'Create comprehensive exit strategies including data migration plans, alternative vendor options, and transition timelines.',
      dueDate: '2026-07-15',
    },
    {
      id: 'GAP-002',
      title: 'Expired SOC2 Reports',
      severity: 'High',
      affected: 5,
      description: 'Five vendors have SOC2 Type II reports older than 12 months.',
      recommendation: 'Request updated SOC2 Type II reports from all affected vendors within 30 days.',
      dueDate: '2026-07-01',
    },
    {
      id: 'GAP-003',
      title: 'Incomplete Vendor Reviews',
      severity: 'Medium',
      affected: 12,
      description: 'Twelve vendors have not undergone annual risk assessment in the past 12 months.',
      recommendation: 'Schedule and complete annual vendor risk assessments per DORA Article 30.',
      dueDate: '2026-08-30',
    },
  ];

  return (
    <div className="p-8">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-[32px] font-bold text-[#111827] mb-2">DORA Gap Analysis</h1>
        <p className="text-[14px] text-[#6B7280] mb-8">Compliance gaps with prioritized remediation recommendations</p>

        <div className="grid grid-cols-4 gap-5 mb-6">
          <StatCard title="Total Gaps" value="8" subtitle="Identified issues" icon={AlertTriangle} color="amber" />
          <StatCard title="Critical" value="2" subtitle="Immediate action required" icon={XCircle} color="red" />
          <StatCard title="In Progress" value="3" subtitle="Being addressed" icon={Activity} color="blue" />
          <StatCard title="Resolved" value="15" subtitle="This quarter" icon={CheckCircle2} color="green" trend={25} />
        </div>

        <div className="space-y-4">
          {gaps.map((gap) => (
            <div key={gap.id} className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[12px] font-mono font-semibold text-[#6B7280]">{gap.id}</span>
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                      gap.severity === 'Critical' ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]' :
                      gap.severity === 'High' ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]' :
                      'bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]'
                    }`}>
                      {gap.severity}
                    </span>
                    <span className="text-[12px] text-[#6B7280]">{gap.affected} vendors affected</span>
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#111827] mb-2">{gap.title}</h3>
                  <p className="text-[14px] text-[#6B7280] mb-4">{gap.description}</p>
                  <div className="bg-gradient-to-r from-[#EFF6FF] to-[#F0F9FF] border border-[#BFDBFE] rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#2563EB] mt-0.5" />
                      <div>
                        <p className="text-[11px] font-semibold text-[#1E3A8A] uppercase mb-1">Recommended Action</p>
                        <p className="text-[13px] text-[#111827]">{gap.recommendation}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ml-6 text-right">
                  <p className="text-[11px] text-[#6B7280] mb-1">Due Date</p>
                  <p className="text-[13px] font-semibold text-[#111827]">{gap.dueDate}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditPackage() {
  const packages = [
    { title: 'ICT Third-Party Register', items: '143 vendors', icon: FileText, color: 'blue' },
    { title: 'Critical Vendor Inventory', items: '17 vendors', icon: Shield, color: 'red' },
    { title: 'Risk Assessment Reports', items: '143 assessments', icon: BarChart3, color: 'purple' },
    { title: 'Evidence Documentation', items: '87 documents', icon: FileCheck, color: 'green' },
    { title: 'Concentration Risk Analysis', items: '6 risk areas', icon: Target, color: 'amber' },
    { title: 'Gap Analysis Report', items: '8 gaps identified', icon: AlertTriangle, color: 'amber' },
    { title: 'Remediation Action Plan', items: '24 action items', icon: CheckCircle2, color: 'blue' },
    { title: 'Review History Log', items: '89 reviews completed', icon: Clock, color: 'purple' },
  ];

  return (
    <div className="p-8">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-[32px] font-bold text-[#111827] mb-2">Audit Package Generator</h1>
        <p className="text-[14px] text-[#6B7280] mb-8">Export comprehensive DORA-compliant documentation for regulatory review</p>

        <div className="bg-gradient-to-r from-[#DCFCE7] to-[#D1FAE5] border border-[#BBF7D0] rounded-xl p-6 mb-8 flex items-start gap-4">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-6 h-6 text-[#16A34A]" />
          </div>
          <div className="flex-1">
            <h3 className="text-[18px] font-semibold text-[#166534] mb-1">Audit Package Ready for Export</h3>
            <p className="text-[14px] text-[#166534]">
              All documentation is current and formatted according to DORA regulatory requirements. Last updated June 9, 2026.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-8">
          {packages.map((pkg, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-lg hover:border-[#D1D5DB] transition-all cursor-pointer group">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  pkg.color === 'blue' ? 'bg-[#EFF6FF]' :
                  pkg.color === 'red' ? 'bg-[#FEF2F2]' :
                  pkg.color === 'green' ? 'bg-[#F0FDF4]' :
                  pkg.color === 'amber' ? 'bg-[#FFFBEB]' :
                  'bg-[#F5F3FF]'
                }`}>
                  <pkg.icon className={`w-6 h-6 ${
                    pkg.color === 'blue' ? 'text-[#2563EB]' :
                    pkg.color === 'red' ? 'text-[#DC2626]' :
                    pkg.color === 'green' ? 'text-[#16A34A]' :
                    pkg.color === 'amber' ? 'text-[#D97706]' :
                    'text-[#7C3AED]'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[16px] font-semibold text-[#111827] mb-1 group-hover:text-[#2563EB] transition-colors">{pkg.title}</h3>
                  <p className="text-[13px] text-[#6B7280] mb-3">{pkg.items}</p>
                  <div className="flex items-center gap-2 text-[#2563EB] text-[12px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download report</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-lg font-medium hover:bg-[#1D4ED8] transition-colors shadow-sm">
            <Package className="w-5 h-5" />
            Generate Complete Package
          </button>
          <button className="px-6 py-3 bg-white border border-[#E5E7EB] text-[#374151] rounded-lg font-medium hover:bg-[#F9FAFB] transition-colors">
            Export as PDF
          </button>
          <button className="px-6 py-3 bg-white border border-[#E5E7EB] text-[#374151] rounded-lg font-medium hover:bg-[#F9FAFB] transition-colors">
            Export as Excel
          </button>
        </div>
      </div>
    </div>
  );
}
