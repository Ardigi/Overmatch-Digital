#!/usr/bin/env python3
"""
Script to add missing methods to ControlsService
"""

def add_missing_methods():
    # Read the service file
    service_file = 'controls.service.ts'
    with open(service_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Read the missing methods
    with open('missing-methods.ts', 'r', encoding='utf-8') as f:
        missing_methods = f.read()
    
    # Find the last closing brace and insert methods before it
    last_brace_pos = content.rfind('}')
    
    if last_brace_pos != -1:
        # Insert methods before the last closing brace
        new_content = content[:last_brace_pos] + '\n' + missing_methods + '\n}\n'
        
        # Write back to file
        with open(service_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("Successfully added missing methods to ControlsService")
    else:
        print("Could not find closing brace in service file")

if __name__ == '__main__':
    add_missing_methods()