'use client'

import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Upload, Send, BarChart3, Download, Edit2, Check, X, Filter, ChevronDown, Loader2, Eye, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'

// Types
interface Lead {
  id: string
  email: string
  company?: string
  name?: string
  title?: string
  industry?: string
  companySize?: string
  fundingStage?: string
  enriched?: boolean
  enrichmentData?: Record<string, any>
}

interface EmailDraft {
  leadId: string
  subjectLine: string
  body: string
  personalizationNotes?: string
  approved?: boolean
}

interface Campaign {
  id: string
  name: string
  createdAt: string
  status: 'draft' | 'enriching' | 'generating' | 'review' | 'sending' | 'completed'
  leads: Lead[]
  drafts: EmailDraft[]
  deliveryResults?: {
    sentEmails: string[]
    failedEmails: string[]
  }
  analytics?: {
    opens: number
    clicks: number
    bounces: number
    unsubscribes: number
  }
}

// Main App Component
export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [editingDraft, setEditingDraft] = useState<EmailDraft | null>(null)
  const [filterIndustry, setFilterIndustry] = useState<string>('all')
  const [filterSize, setFilterSize] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCsvDialog, setShowCsvDialog] = useState(false)
  const [csvContent, setCsvContent] = useState('')
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null)

  // Handle CSV Upload
  const handleCsvUpload = async () => {
    if (!csvContent.trim()) return
    setLoading(true)
    try {
      const lines = csvContent.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

      const leads: Lead[] = lines.slice(1).map((line, idx) => {
        const values = line.split(',').map(v => v.trim())
        const lead: Lead = {
          id: `lead-${Date.now()}-${idx}`,
          email: values[headers.indexOf('email')] || '',
          name: values[headers.indexOf('name')] || '',
          company: values[headers.indexOf('company')] || '',
          title: values[headers.indexOf('title')] || '',
          enriched: false
        }
        return lead
      }).filter(l => l.email)

      const newCampaign: Campaign = {
        id: `campaign-${Date.now()}`,
        name: `Campaign ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        status: 'draft',
        leads,
        drafts: [],
        analytics: { opens: 0, clicks: 0, bounces: 0, unsubscribes: 0 }
      }

      setCampaigns([newCampaign, ...campaigns])
      setActiveCampaign(newCampaign)
      setCsvContent('')
      setShowCsvDialog(false)
    } finally {
      setLoading(false)
    }
  }

  // Enrich Leads
  const enrichLeads = async () => {
    if (!activeCampaign || activeCampaign.leads.length === 0) return
    setLoading(true)
    const updatedCampaign = { ...activeCampaign, status: 'enriching' as const }

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Enrich these leads with Apollo data: ${JSON.stringify(activeCampaign.leads.map(l => ({ email: l.email, name: l.name, company: l.company })))}`,
          agent_id: '6902b0e4e26dd0e03684e4e3'
        })
      })

      const data = await response.json()
      const enrichedData = data.response?.enriched_leads || []

      const updatedLeads = activeCampaign.leads.map(lead => {
        const enrichment = enrichedData.find((e: any) => e.email === lead.email)
        return enrichment ? {
          ...lead,
          enriched: true,
          enrichmentData: enrichment,
          industry: enrichment.industry || lead.industry,
          companySize: enrichment.company_size || lead.companySize,
          fundingStage: enrichment.funding_stage || lead.fundingStage
        } : lead
      })

      updatedCampaign.leads = updatedLeads
      updatedCampaign.status = 'generating'
      setCampaigns(campaigns.map(c => c.id === activeCampaign.id ? updatedCampaign : c))
      setActiveCampaign(updatedCampaign)

      // Generate drafts after enrichment
      await generateDrafts(updatedCampaign)
    } catch (err) {
      console.error(err)
      updatedCampaign.status = 'draft'
      setCampaigns(campaigns.map(c => c.id === activeCampaign.id ? updatedCampaign : c))
      setActiveCampaign(updatedCampaign)
    } finally {
      setLoading(false)
    }
  }

  // Generate Email Drafts
  const generateDrafts = async (campaign: Campaign) => {
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Generate personalized email drafts for these leads: ${JSON.stringify(campaign.leads.map(l => ({ email: l.email, name: l.name, company: l.company, industry: l.industry, title: l.title })))}`,
          agent_id: '6902b0f3de7c6b951ae00e7c'
        })
      })

      const data = await response.json()
      const draftsData = data.response?.email_drafts || []

      const drafts: EmailDraft[] = draftsData.map((draft: any) => ({
        leadId: draft.lead_id || draft.email,
        subjectLine: draft.subject_line || '',
        body: draft.body || '',
        personalizationNotes: draft.personalization_notes || '',
        approved: false
      }))

      const updatedCampaign = { ...campaign }
      updatedCampaign.drafts = drafts
      updatedCampaign.status = 'review'
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? updatedCampaign : c))
      setActiveCampaign(updatedCampaign)
    } catch (err) {
      console.error(err)
    }
  }

  // Send Approved Emails
  const sendEmails = async () => {
    if (!activeCampaign) return
    setSendingCampaignId(activeCampaign.id)
    const updatedCampaign = { ...activeCampaign, status: 'sending' as const }
    setCampaigns(campaigns.map(c => c.id === activeCampaign.id ? updatedCampaign : c))
    setActiveCampaign(updatedCampaign)

    try {
      const approvedDrafts = activeCampaign.drafts.filter(d => d.approved)
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Send these approved emails via Gmail: ${JSON.stringify(approvedDrafts)}`,
          agent_id: '6902b118cb70cd01d3078545'
        })
      })

      const data = await response.json()
      const results = data.response?.delivery_results || {}

      updatedCampaign.deliveryResults = {
        sentEmails: results.sent_emails || [],
        failedEmails: results.failed_emails || []
      }
      updatedCampaign.status = 'completed'
      setCampaigns(campaigns.map(c => c.id === activeCampaign.id ? updatedCampaign : c))
      setActiveCampaign(updatedCampaign)
    } catch (err) {
      console.error(err)
      updatedCampaign.status = 'review'
      setCampaigns(campaigns.map(c => c.id === activeCampaign.id ? updatedCampaign : c))
      setActiveCampaign(updatedCampaign)
    } finally {
      setSendingCampaignId(null)
    }
  }

  // Toggle Lead Selection
  const toggleLeadSelection = (leadId: string) => {
    const newSelection = new Set(selectedLeads)
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId)
    } else {
      newSelection.add(leadId)
    }
    setSelectedLeads(newSelection)
  }

  // Bulk Approve Drafts
  const bulkApproveDrafts = () => {
    if (!activeCampaign) return
    const updated = { ...activeCampaign }
    updated.drafts = updated.drafts.map(draft =>
      selectedLeads.has(draft.leadId) ? { ...draft, approved: true } : draft
    )
    setCampaigns(campaigns.map(c => c.id === activeCampaign.id ? updated : c))
    setActiveCampaign(updated)
    setSelectedLeads(new Set())
  }

  // Filter and Sort Leads
  const filteredLeads = useMemo(() => {
    if (!activeCampaign) return []
    return activeCampaign.leads.filter(lead => {
      if (filterIndustry !== 'all' && lead.industry !== filterIndustry) return false
      if (filterSize !== 'all' && lead.companySize !== filterSize) return false
      if (filterStatus === 'enriched' && !lead.enriched) return false
      if (filterStatus === 'pending' && lead.enriched) return false
      return true
    })
  }, [activeCampaign, filterIndustry, filterSize, filterStatus])

  // Export CSV
  const exportCsv = () => {
    if (!activeCampaign) return
    const headers = ['Email', 'Name', 'Company', 'Title', 'Industry', 'Company Size', 'Status']
    const rows = filteredLeads.map(l => [
      l.email,
      l.name || '',
      l.company || '',
      l.title || '',
      l.industry || '',
      l.companySize || '',
      l.enriched ? 'Enriched' : 'Pending'
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campaign-${activeCampaign.id}.csv`
    a.click()
  }

  // Get unique filter values
  const industries = useMemo(() =>
    Array.from(new Set(activeCampaign?.leads.map(l => l.industry).filter(Boolean) || [])),
    [activeCampaign]
  )

  const companySizes = useMemo(() =>
    Array.from(new Set(activeCampaign?.leads.map(l => l.companySize).filter(Boolean) || [])),
    [activeCampaign]
  )

  // Get draft for lead
  const getDraftForLead = (leadId: string) =>
    activeCampaign?.drafts.find(d => d.leadId === leadId)

  // Stats
  const stats = useMemo(() => {
    if (!activeCampaign) return { total: 0, enriched: 0, approved: 0, sent: 0, failed: 0 }
    return {
      total: activeCampaign.leads.length,
      enriched: activeCampaign.leads.filter(l => l.enriched).length,
      approved: activeCampaign.drafts.filter(d => d.approved).length,
      sent: activeCampaign.deliveryResults?.sentEmails.length || 0,
      failed: activeCampaign.deliveryResults?.failedEmails.length || 0
    }
  }, [activeCampaign])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lead Campaign Manager</h1>
            <p className="text-sm text-slate-600">Enrich, personalize, and send targeted email campaigns</p>
          </div>
          <div className="flex gap-2">
            {activeCampaign && (
              <>
                <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Upload className="w-4 h-4" />
                      New Campaign
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Leads (CSV)</DialogTitle>
                      <DialogDescription>Paste CSV data with columns: email, name, company, title</DialogDescription>
                    </DialogHeader>
                    <Textarea
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      placeholder="email,name,company,title&#10;john@example.com,John Doe,Acme Inc,Manager"
                      className="min-h-32"
                    />
                    <Button onClick={handleCsvUpload} disabled={loading} className="w-full gap-2">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Create Campaign
                    </Button>
                  </DialogContent>
                </Dialog>
                <Button onClick={enrichLeads} disabled={loading || !activeCampaign.leads.length} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enrich & Generate
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!activeCampaign ? (
          <div className="flex flex-col items-center justify-center min-h-96 gap-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Start New Campaign
                </CardTitle>
                <CardDescription>Upload a CSV file with lead data</CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                      <Upload className="w-4 h-4" />
                      Upload CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Leads (CSV)</DialogTitle>
                      <DialogDescription>Paste CSV data with columns: email, name, company, title</DialogDescription>
                    </DialogHeader>
                    <Textarea
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      placeholder="email,name,company,title&#10;john@example.com,John Doe,Acme Inc,Manager"
                      className="min-h-32"
                    />
                    <Button onClick={handleCsvUpload} disabled={loading} className="w-full gap-2">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Create Campaign
                    </Button>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
            {campaigns.length > 0 && (
              <div className="w-full">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Recent Campaigns</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {campaigns.map(campaign => (
                    <Card key={campaign.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveCampaign(campaign)}>
                      <CardContent className="pt-6">
                        <p className="font-semibold text-slate-900">{campaign.name}</p>
                        <p className="text-sm text-slate-600">{campaign.leads.length} leads</p>
                        <Badge className="mt-2" variant={campaign.status === 'completed' ? 'default' : 'secondary'}>
                          {campaign.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {/* Stats Cards */}
            {[
              { label: 'Total Leads', value: stats.total, icon: BarChart3, color: 'text-blue-600' },
              { label: 'Enriched', value: stats.enriched, icon: CheckCircle, color: 'text-green-600' },
              { label: 'Approved', value: stats.approved, icon: Check, color: 'text-emerald-600' },
              { label: 'Sent', value: stats.sent, icon: Send, color: 'text-cyan-600' }
            ].map((stat, idx) => (
              <Card key={idx} className="bg-white border-slate-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="leads" className="space-y-4">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="leads">Leads & Enrichment</TabsTrigger>
              <TabsTrigger value="emails">Email Drafts</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Leads Tab */}
            <TabsContent value="leads">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Lead Database</CardTitle>
                      <CardDescription>View and manage enriched lead data</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="flex gap-3 mb-4 flex-wrap">
                    <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Industries</SelectItem>
                        {industries.map(ind => (
                          <SelectItem key={ind} value={ind || ''}>{ind}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterSize} onValueChange={setFilterSize}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sizes</SelectItem>
                        {companySizes.map(size => (
                          <SelectItem key={size} value={size || ''}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="enriched">Enriched</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Table */}
                  <ScrollArea className="rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-12 text-center">
                            <Checkbox
                              checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLeads(new Set(filteredLeads.map(l => l.id)))
                                } else {
                                  setSelectedLeads(new Set())
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Industry</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeads.map(lead => (
                          <TableRow key={lead.id} className={selectedLeads.has(lead.id) ? 'bg-blue-50' : ''}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedLeads.has(lead.id)}
                                onCheckedChange={() => toggleLeadSelection(lead.id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{lead.email}</TableCell>
                            <TableCell>{lead.name || '-'}</TableCell>
                            <TableCell>{lead.company || '-'}</TableCell>
                            <TableCell>{lead.title || '-'}</TableCell>
                            <TableCell>{lead.industry || '-'}</TableCell>
                            <TableCell>{lead.companySize || '-'}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={lead.enriched ? 'bg-green-600' : 'bg-slate-400'}>
                                {lead.enriched ? 'Enriched' : 'Pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Emails Tab */}
            <TabsContent value="emails" className="space-y-4">
              {activeCampaign.drafts.length > 0 && (
                <div className="flex gap-2 mb-4">
                  <Button onClick={bulkApproveDrafts} disabled={selectedLeads.size === 0} variant="outline" className="gap-2">
                    <Check className="w-4 h-4" />
                    Approve Selected ({selectedLeads.size})
                  </Button>
                  <Button
                    onClick={sendEmails}
                    disabled={!activeCampaign.drafts.some(d => d.approved) || sendingCampaignId === activeCampaign.id}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {sendingCampaignId === activeCampaign.id && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Approved ({activeCampaign.drafts.filter(d => d.approved).length})
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Draft List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Email Drafts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-2 pr-4">
                        {activeCampaign.drafts.map((draft, idx) => {
                          const lead = activeCampaign.leads.find(l => l.id === draft.leadId)
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setEditingDraft(draft)
                                setSelectedLeads(new Set([draft.leadId]))
                              }}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                editingDraft?.leadId === draft.leadId
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">{lead?.email}</p>
                                  <p className="text-xs text-slate-600 truncate">{draft.subjectLine}</p>
                                </div>
                                <Badge variant={draft.approved ? 'default' : 'secondary'} className="ml-auto">
                                  {draft.approved ? 'Approved' : 'Pending'}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Draft Editor */}
                {editingDraft && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Edit Draft</CardTitle>
                      <CardDescription>Review and approve email</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Subject Line</label>
                        <Input
                          value={editingDraft.subjectLine}
                          onChange={(e) => setEditingDraft({ ...editingDraft, subjectLine: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Email Body</label>
                        <Textarea
                          value={editingDraft.body}
                          onChange={(e) => setEditingDraft({ ...editingDraft, body: e.target.value })}
                          className="mt-1 min-h-32"
                        />
                      </div>
                      {editingDraft.personalizationNotes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-blue-900 mb-1">Personalization Notes</p>
                          <p className="text-sm text-blue-800">{editingDraft.personalizationNotes}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-4">
                        <Button
                          onClick={() => {
                            const updated = { ...activeCampaign }
                            updated.drafts = updated.drafts.map(d => d.leadId === editingDraft.leadId ? editingDraft : d)
                            setCampaigns(campaigns.map(c => c.id === activeCampaign.id ? updated : c))
                            setActiveCampaign(updated)
                            setEditingDraft(null)
                          }}
                          className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                          <Check className="w-4 h-4" />
                          Save Changes
                        </Button>
                        <Button
                          onClick={() => {
                            const updated = { ...activeCampaign }
                            updated.drafts = updated.drafts.map(d =>
                              d.leadId === editingDraft.leadId ? { ...d, approved: !d.approved } : d
                            )
                            setCampaigns(campaigns.map(c => c.id === activeCampaign.id ? updated : c))
                            setActiveCampaign(updated)
                          }}
                          variant={editingDraft.approved ? 'destructive' : 'outline'}
                          className="flex-1 gap-2"
                        >
                          {editingDraft.approved ? (
                            <>
                              <X className="w-4 h-4" />
                              Unapprove
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Approve
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Emails Sent', value: stats.sent, color: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-700', icon: Send },
                  { label: 'Failed', value: stats.failed, color: 'bg-red-50 border-red-200', textColor: 'text-red-700', icon: AlertCircle },
                  { label: 'Opens', value: activeCampaign.analytics?.opens || 0, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700', icon: Eye },
                  { label: 'Clicks', value: activeCampaign.analytics?.clicks || 0, color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700', icon: TrendingUp }
                ].map((metric, idx) => (
                  <Card key={idx} className={`border ${metric.color}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-600">{metric.label}</p>
                          <p className={`text-3xl font-bold ${metric.textColor}`}>{metric.value}</p>
                        </div>
                        <metric.icon className={`w-8 h-8 ${metric.textColor}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {activeCampaign.deliveryResults && (
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <p className="text-sm text-emerald-700 font-medium">Successfully Sent</p>
                        <p className="text-2xl font-bold text-emerald-900">{activeCampaign.deliveryResults.sentEmails.length}</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-700 font-medium">Failed Delivery</p>
                        <p className="text-2xl font-bold text-red-900">{activeCampaign.deliveryResults.failedEmails.length}</p>
                      </div>
                    </div>

                    {activeCampaign.deliveryResults.failedEmails.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-slate-900 mb-2">Failed Emails</h4>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <ul className="space-y-1">
                            {activeCampaign.deliveryResults.failedEmails.map((email, idx) => (
                              <li key={idx} className="text-sm text-red-700 font-mono">{email}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
