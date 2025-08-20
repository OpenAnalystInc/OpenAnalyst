# oacode Change Marking Guidelines

We are a fork of Roo. We regularly merge in the Roo codebase. To enable us to merge more easily, we mark all
our own changes with `oacode_change` comments.

## Basic Usage

### Single Line Changes

For single line changes, add the comment at the end of the line:

```typescript
let i = 2 // oacode_change
```

### Multi-line Changes

For multiple consecutive lines, wrap them with start/end comments:

```typescript
// oacode_change start
let i = 2
let j = 3
// oacode_change end
```

## Language-Specific Examples

### HTML/JSX/TSX

```html
{/* oacode_change start */}
<CustomoaComponent />
{/* oacode_change end */}
```

### CSS/SCSS

```css
/* oacode_change */
.oacode-specific-class {
	color: blue;
}

/* oacode_change start */
.another-class {
	background: red;
}
/* oacode_change end */
```

## Special Cases

### oacode specific file

if the filename or directory name contains oacode no marking with comments is required

### New Files

If you're creating a completely new file that doesn't exist in Roo, add this comment at the top:

```
// oacode_change - new file
```
