with open('src/pages/MethodologyPage.tsx', 'rb') as f:
    content = f.read()

# Replace literal < with <
content = content.replace(b'UNKNOWN < 25', b'UNKNOWN < 25')
content = content.replace(b'>15min', b'>15min')

with open('src/pages/MethodologyPage.tsx', 'wb') as f:
    f.write(content)
print('Done')