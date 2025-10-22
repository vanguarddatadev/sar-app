-- Manual Journal Entry System for Sessions
-- Allows manual data entry with custom templates

-- 1. Journal Templates Table
CREATE TABLE IF NOT EXISTS journal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    fields JSONB NOT NULL, -- Array of field definitions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- 2. Add source column to sessions table if not exists
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'gsheet' CHECK (source IN ('gsheet', 'manual'));

-- 3. Seed SC Session Template
INSERT INTO journal_templates (organization_id, name, description, fields) VALUES (
    '6b784659-250f-46a5-9b61-7bd4666e30af', -- Vanguard org ID
    'SC - Session',
    'Santa Clara bingo session data entry',
    '[
        {"name": "date", "label": "Session Date", "type": "date", "required": true},
        {"name": "late", "label": "Late Session", "type": "checkbox", "required": false},
        {"name": "flash", "label": "Flash", "type": "number", "required": false},
        {"name": "cherries", "label": "Cherries", "type": "number", "required": false},
        {"name": "paper", "label": "Paper", "type": "number", "required": false},
        {"name": "strips", "label": "Strips", "type": "number", "required": false},
        {"name": "merch_other", "label": "Merch/Other", "type": "number", "required": false},
        {"name": "total_sales", "label": "Total Sales", "type": "number", "required": false},
        {"name": "strip_payouts", "label": "Strip Payouts", "type": "number", "required": false},
        {"name": "paper_game_payouts", "label": "Paper Game Payouts", "type": "number", "required": false},
        {"name": "flash_payouts", "label": "Flash Payouts", "type": "number", "required": false},
        {"name": "all_numbers_games", "label": "All Numbers Games", "type": "number", "required": false},
        {"name": "double_action", "label": "Double Action", "type": "number", "required": false},
        {"name": "winnemucca", "label": "Winnemucca", "type": "number", "required": false},
        {"name": "rwb", "label": "RWB", "type": "number", "required": false},
        {"name": "cherry_redeemed", "label": "Cherry Redeemed", "type": "number", "required": false},
        {"name": "cherry_from_winn", "label": "Cherry from Winn game", "type": "number", "required": false},
        {"name": "gift_cert", "label": "Gift Cert", "type": "number", "required": false},
        {"name": "refund_other", "label": "Refund/Other", "type": "number", "required": false},
        {"name": "flash_redeemed", "label": "Flash Redeemed", "type": "number", "required": false},
        {"name": "total_payouts", "label": "Total Payouts", "type": "number", "required": false},
        {"name": "hotball_hit", "label": "Hotball Hit", "type": "checkbox", "required": false},
        {"name": "hotball_change", "label": "Hotball Change", "type": "number", "required": false},
        {"name": "hotball_total", "label": "Hotball Total", "type": "number", "required": false},
        {"name": "hotball_participation", "label": "Hotball Participation", "type": "number", "required": false},
        {"name": "attendance", "label": "SC Attendance", "type": "number", "required": false}
    ]'::jsonb
) ON CONFLICT (organization_id, name) DO NOTHING;

-- 4. Seed RWC Session Template
INSERT INTO journal_templates (organization_id, name, description, fields) VALUES (
    '6b784659-250f-46a5-9b61-7bd4666e30af',
    'RWC - Session',
    'Redwood City bingo session data entry',
    '[
        {"name": "date", "label": "Session Date", "type": "date", "required": true},
        {"name": "late", "label": "Late Session", "type": "checkbox", "required": false},
        {"name": "flash", "label": "Flash", "type": "number", "required": false},
        {"name": "cherries", "label": "Cherries", "type": "number", "required": false},
        {"name": "paper", "label": "Paper", "type": "number", "required": false},
        {"name": "strips", "label": "Strips", "type": "number", "required": false},
        {"name": "merch_other", "label": "Merch/Other", "type": "number", "required": false},
        {"name": "total_sales", "label": "Total Sales", "type": "number", "required": false},
        {"name": "strip_payouts", "label": "Strip Payouts", "type": "number", "required": false},
        {"name": "paper_game_payouts", "label": "Paper Game Payouts", "type": "number", "required": false},
        {"name": "flash_payouts", "label": "Flash Payouts", "type": "number", "required": false},
        {"name": "all_numbers_games", "label": "All Numbers Games", "type": "number", "required": false},
        {"name": "double_action", "label": "Double Action", "type": "number", "required": false},
        {"name": "winnemucca", "label": "Winnemucca", "type": "number", "required": false},
        {"name": "rwb", "label": "RWB", "type": "number", "required": false},
        {"name": "cherry_redeemed", "label": "Cherry Redeemed", "type": "number", "required": false},
        {"name": "cherry_from_winn", "label": "Cherry from Winn game", "type": "number", "required": false},
        {"name": "gift_cert", "label": "Gift Cert", "type": "number", "required": false},
        {"name": "refund_other", "label": "Refund/Other", "type": "number", "required": false},
        {"name": "flash_redeemed", "label": "Flash Redeemed", "type": "number", "required": false},
        {"name": "total_payouts", "label": "Total Payouts", "type": "number", "required": false},
        {"name": "hotball_hit", "label": "Hotball Hit", "type": "checkbox", "required": false},
        {"name": "hotball_change", "label": "Hotball Change", "type": "number", "required": false},
        {"name": "hotball_total", "label": "Hotball Total", "type": "number", "required": false},
        {"name": "hotball_participation", "label": "Hotball Participation", "type": "number", "required": false},
        {"name": "attendance", "label": "RWC Attendance", "type": "number", "required": false}
    ]'::jsonb
) ON CONFLICT (organization_id, name) DO NOTHING;

-- Enable RLS
ALTER TABLE journal_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_templates
CREATE POLICY "Users can view templates for their org" ON journal_templates
    FOR SELECT USING (organization_id IN (
        SELECT id FROM organizations WHERE id = organization_id
    ));

CREATE POLICY "Users can insert templates for their org" ON journal_templates
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT id FROM organizations WHERE id = organization_id
    ));

CREATE POLICY "Users can update templates for their org" ON journal_templates
    FOR UPDATE USING (organization_id IN (
        SELECT id FROM organizations WHERE id = organization_id
    ));

CREATE POLICY "Users can delete templates for their org" ON journal_templates
    FOR DELETE USING (organization_id IN (
        SELECT id FROM organizations WHERE id = organization_id
    ));
