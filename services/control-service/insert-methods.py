#!/usr/bin/env python3
import os

def insert_missing_methods():
    service_file = r'C:\Users\Ryann\Documents\Work\Coding\overmatch-digital\services\control-service\src\modules\controls\controls.service.ts'
    methods_file = r'C:\Users\Ryann\Documents\Work\Coding\overmatch-digital\services\control-service\src\modules\controls\missing-methods.ts'
    
    # Read the current service file
    with open(service_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Read the methods to insert
    with open(methods_file, 'r', encoding='utf-8') as f:
        methods_content = f.read()
    
    # Find the last closing brace
    lines = content.split('\n')
    
    # Find the last line that is just '}'
    last_brace_line = -1
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() == '}':
            last_brace_line = i
            break
    
    if last_brace_line == -1:
        print("Could not find the closing brace")
        return False
    
    # Insert the methods before the closing brace
    method_lines = methods_content.split('\n')
    
    # Insert methods before the last closing brace
    new_lines = lines[:last_brace_line] + [''] + method_lines + [''] + [lines[last_brace_line]]
    
    # Write the updated content
    new_content = '\n'.join(new_lines)
    
    with open(service_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Successfully inserted methods into {service_file}")
    return True

if __name__ == '__main__':
    insert_missing_methods()