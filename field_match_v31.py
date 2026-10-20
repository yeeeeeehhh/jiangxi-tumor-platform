"""
Match system requirement fields vs V3.1 spec fields
Output: Excel matrix with match status
"""

import re
import json
from openpyxl import Workbook

def parse_demand_md(md_path):
    """Parse demand_nostatus.md into list of {module_code, module_name, field_name}"""
    fields = []
    current_module = None
    
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # State machine: detect section headers and field tables
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Match section like "## S1  区域人口健康平台 / 居民主索引"
        m_section = re.match(r'^##\s+(S\d+)\s+(.+)', line)
        if m_section:
            current_module = {
                'code': m_section.group(1),
                'name': m_section.group(2).strip(),
                'fields': []
            }
            i += 1
            continue
        
        if not current_module:
            i += 1
            continue
        
        # Look for horizontal separator line (| 字段 | ... )
        if '| 字段 |' in line or re.search(r'^\|.*\|$', line):
            # Collect next N lines for field values
            table_row = []
            j = i
            while j <= min(i+4, len(lines)-1) and re.search(r'^\|.*\|$', lines[j]):
                row_content = lines[j].strip()
                cells = [c.strip() for c in row_content.split('|') if c.strip()]
                # Skip first and last if they're empty (| cell | -> ['', cell, '', ...])
                if cells[0] == '' and len(cells) > 1:
                    cells = cells[1:]
                if cells[-1] == '' and len(cells) > 1:
                    cells = cells[:-1]
                table_row.extend([c for c in cells if c and c != '字段'])
                j += 1
            
            for field in table_row:
                if field:
                    current_module['fields'].append(field)
            
            i = j
            continue
        
        i += 1
    
    # Flatten to list
    result = []
    for mod in current_module and current_module.get('fields', []) or []:
        if isinstance(mod, dict):
            result.append(mod)
        else:
            pass
    
    # Actually, the above parsing is too complex. Let me re-read the file structure differently.
    # Re-parse by scanning after section headers until next section header, extract field names from pipe-separated lines.
    result = []
    
    current_module = None
    in_field_table = False
    
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    sections = re.split(r'^##\s+(S\d+)', content, flags=re.MULTILINE)
    for idx in range(1, len(sections), 2):
        mod_code = sections[idx]
        mod_text = sections[idx+1] if idx+1 < len(sections) else ""
        
        # Extract module name from first line
        m_name = re.match(r'\s*(.+)\n', mod_text)
        mod_name = m_name.group(1).strip() if m_name else mod_text.strip().split('\n')[0].strip()
        
        # Extract field tables (pipe-separated)
        table_blocks = re.findall(r'\|(?:字段 \|)+\n((?:\|[^\|\n]+\|\n?)+)', mod_text)
        
        for block in table_blocks:
            lines = block.strip().split('\n')
            for line in lines:
                # Remove leading/trailing |
                cells = [c.strip() for c in line.split('|')]
                cells = [c for c in cells if c and c != '字段']
                for field in cells:
                    if field and len(field) > 0:
                        result.append({
                            'module_code': mod_code,
                            'module_name': mod_name,
                            'field_name': field
                        })
    
    return result


# Check parsing
if __name__ == "__main__":
    fields_req = parse_demand_md(r"G:\Desktop\江西肿瘤\app\_tmp_jx_v31_extract\demand_nostatus.md")
    print(f"Parsed {len(fields_req)} fields")
    for f in fields_req[:20]:
        print(f)
