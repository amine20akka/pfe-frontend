export function labelize(fieldName: string): string {
    return fieldName
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before uppercase letters
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Add space between consecutive uppercase letters and lowercase letters
        .replace(/_/g, ' ') // Replace underscores with spaces
        .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize the first letter of each word
}