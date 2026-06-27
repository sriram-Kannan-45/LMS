# 🎨 Component API Reference

## All New & Enhanced Components

---

## 🔔 Toast Component

**File:** `src/components/Toast.jsx`

### Provider Setup
Wrap your app with `ToastProvider`:
```jsx
import { ToastProvider } from './components/Toast'

function App() {
  return (
    <ToastProvider>
      {/* Your app routes */}
    </ToastProvider>
  )
}
```

### Hook Usage
```jsx
import { useToast } from '../components/Toast'

function MyComponent() {
  const { success, error, warning, info, addToast, removeToast } = useToast()

  return (
    <>
      <button onClick={() => success('Saved!')}>Save</button>
      <button onClick={() => error('Failed!', { duration: 5000 })}>Error</button>
      <button onClick={() => warning('Watch out!')}>Warn</button>
      <button onClick={() => info('FYI...')}>Info</button>
    </>
  )
}
```

### API

#### `success(message, options?)`
- **message** (string) - Toast text
- **options.duration** (number) - Milliseconds (default: 4000)
- **options.action** (object) - Optional action button

#### `error(message, options?)`
- Same as success, default duration: 5000

#### `warning(message, options?)`
- Same as success, default duration: 5000

#### `info(message, options?)`
- Same as success, default duration: 4000

#### `addToast(message, options?)`
- **options.type** - 'success' | 'error' | 'warning' | 'info'
- **options.duration** - Milliseconds
- **options.action** - Action button config
- Returns: toast ID

#### `removeToast(id)`
- Manually dismiss a toast

---

## 🔐 Enhanced Login Component

**File:** `src/pages/Login.jsx`

### Props
```jsx
{
  onLogin: (userData) => void  // Called after successful login
}
```

### Features
- Password visibility toggle
- Remember me checkbox
- Forgot password link
- Input icons (Mail, Lock, Eye)
- Gradient button with hover effects
- Toast error notifications
- Loading spinner
- Responsive design
- Glassmorphism background

### Example Usage
```jsx
import Login from './pages/Login'

<Login onLogin={(user) => {
  console.log('Logged in:', user)
  navigate('/dashboard')
}} />
```

---

## 🧠 Enhanced Quiz Component

**File:** `src/components/QuizTaking.jsx`

### Props
```jsx
{
  quizId: number,              // Quiz ID
  attemptId: string,           // Unique attempt ID
  quizData: {
    title: string,
    timeLimit: number,         // Minutes
    questions: Array<{
      id: number,
      questionText: string,
      questionType: 'MCQ' | 'SHORT_ANSWER',
      options?: string[],      // For MCQ
      correctOption?: number   // Optional
    }>
  },
  onSubmit: (result) => void   // Called with results
}
```

### Result Object
```jsx
{
  score: number,              // Correct answers count
  totalQuestions: number,
  timeTaken: number,          // Seconds
  percentage: number,         // 0-100
  feedback?: string
}
```

### Features
- Sticky timer with warnings
- Animated progress bar
- Beautiful option cards
- Smooth transitions
- Confirmation modal
- Question counter
- Mobile responsive
- Toast notifications

### Example Usage
```jsx
import QuizTaking from './components/QuizTaking'

<QuizTaking
  quizId={1}
  attemptId="attempt-123"
  quizData={quizData}
  onSubmit={(result) => {
    console.log('Score:', result.score)
    showResults(result)
  }}
/>
```

---

## 📊 Quiz Results Component

**File:** `src/components/QuizResultsSummary.jsx`

### Props
```jsx
{
  result: {
    score: number,
    totalQuestions: number,
    timeTaken: number,
    percentage?: number          // Will be calculated if not provided
  },
  onViewLeaderboard: () => void
}
```

### Score Badges
```
95-100% → 🏆 Outstanding
80-94%  → ⭐ Excellent
70-79%  → ✨ Great
60-69%  → 👍 Good
50-59%  → 📈 Passed
<50%    → 💪 Keep Trying
```

### Features
- Animated success screen
- Color-coded gradient
- Performance badge
- Score animation
- Stats grid
- Encouragement message
- "View Leaderboard" CTA
- Mobile responsive

### Example Usage
```jsx
import QuizResultsSummary from './components/QuizResultsSummary'

<QuizResultsSummary
  result={{
    score: 8,
    totalQuestions: 10,
    timeTaken: 420
  }}
  onViewLeaderboard={() => setShowLeaderboard(true)}
/>
```

---

## 🏆 Enhanced Leaderboard Component

**File:** `src/components/Leaderboard.jsx`

### Props
```jsx
{
  data: Array<{
    userId?: number,
    name: string,
    score: number,
    timeTaken?: number
  }>,
  title?: string,               // Default: "Quiz Leaderboard"
  showChart?: boolean,          // Default: true
  currentUserId?: number        // Highlights current user
}
```

### Features
- Top 3 podium display
- Current user highlight with "YOU" badge
- Medal badges (🥇🥈🥉)
- Filter buttons
- Score distribution chart
- Responsive table
- Performance badges
- Animated entries
- Empty state

### Performance Badges
```
Score >= 80% → ⭐ Excellent  (Emerald)
60-79%       → 👍 Good       (Blue)
40-59%       → 📈 Passed     (Amber)
<40%         → 💪 Keep Trying (Gray)
```

### Example Usage
```jsx
import Leaderboard from './components/Leaderboard'

<Leaderboard
  data={leaderboardData}
  currentUserId={user.id}
  title="Quiz Rankings"
  showChart={true}
/>
```

---

## ⏳ Skeleton Loader Component

**File:** `src/components/SkeletonLoader.jsx`

### Props
```jsx
{
  type: 'text' | 'card' | 'leaderboard' | 'quiz',
  count?: number,               // Number of items (for lists)
  className?: string            // Additional CSS classes
}
```

### Types

#### `text` - Text line placeholders
```jsx
<SkeletonLoader type="text" count={3} />
```
Displays 3 animated text lines

#### `card` - Card placeholder
```jsx
<SkeletonLoader type="card" />
```
Shows a full card with image and text

#### `leaderboard` - Leaderboard row placeholders
```jsx
<SkeletonLoader type="leaderboard" count={5} />
```
Shows 5 leaderboard entry placeholders

#### `quiz` - Quiz question placeholder
```jsx
<SkeletonLoader type="quiz" />
```
Shows question + 4 option placeholders

### Example Usage
```jsx
import SkeletonLoader from './components/SkeletonLoader'

function MyComponent() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData().then(d => {
      setData(d)
      setLoading(false)
    })
  }, [])

  return (
    <>
      {loading ? (
        <SkeletonLoader type="leaderboard" count={3} />
      ) : (
        <Leaderboard data={data} />
      )}
    </>
  )
}
```

---

## 🎯 Complete Quiz Flow Example

```jsx
import { useState, useEffect } from 'react'
import QuizTaking from './components/QuizTaking'
import QuizResultsSummary from './components/QuizResultsSummary'
import Leaderboard from './components/Leaderboard'
import SkeletonLoader from './components/SkeletonLoader'
import { useToast } from './components/Toast'

function QuizContainer({ user, quizId }) {
  const [step, setStep] = useState('loading')  // loading, quiz, results, leaderboard
  const [quiz, setQuiz] = useState(null)
  const [result, setResult] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const { success, error } = useToast()

  // Load quiz
  useEffect(() => {
    fetchQuiz(quizId)
      .then(q => {
        setQuiz(q)
        setStep('quiz')
      })
      .catch(err => {
        error('Failed to load quiz: ' + err.message)
        setStep('error')
      })
      .finally(() => setLoading(false))
  }, [quizId])

  const handleQuizSubmit = async (quizResult) => {
    setResult(quizResult)
    
    try {
      // Fetch leaderboard data
      const data = await fetchLeaderboard(quizId)
      setLeaderboard(data)
      success('Quiz submitted successfully!')
      setStep('results')
    } catch (err) {
      error('Failed to get results: ' + err.message)
    }
  }

  const handleViewLeaderboard = () => {
    setStep('leaderboard')
  }

  // Loading state
  if (loading) {
    return <SkeletonLoader type="quiz" />
  }

  // Quiz taking
  if (step === 'quiz') {
    return (
      <QuizTaking
        quizId={quizId}
        attemptId={`attempt-${Date.now()}`}
        quizData={quiz}
        onSubmit={handleQuizSubmit}
      />
    )
  }

  // Results
  if (step === 'results') {
    return (
      <div className="space-y-8">
        <QuizResultsSummary
          result={result}
          onViewLeaderboard={handleViewLeaderboard}
        />
      </div>
    )
  }

  // Leaderboard
  if (step === 'leaderboard') {
    return (
      <Leaderboard
        data={leaderboard}
        currentUserId={user.id}
        title={`${quiz?.title} - Leaderboard`}
        showChart={true}
      />
    )
  }

  return null
}

export default QuizContainer
```

---

## 🎨 Styling Customization

### CSS Variables (in `src/index.css`)

**Colors:**
```css
--accent: #6366f1;
--accent-hover: #4f46e5;
--accent-light: rgba(99, 102, 241, 0.08);
--success: #059669;
--warning: #d97706;
--danger: #dc2626;
```

**Gradients:**
```css
--gradient-primary: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
--gradient-primary-soft: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
```

**Shadows:**
```css
--shadow-lg: 0 10px 24px rgba(0, 0, 0, 0.06);
--shadow-glow: 0 0 20px rgba(99, 102, 241, 0.12);
```

### Override Colors
```css
:root {
  --accent: #your-color;
  --gradient-primary: linear-gradient(135deg, #color1 0%, #color2 100%);
}
```

---

## 📱 Responsive Tips

All components use Tailwind breakpoints:
- Use `sm:`, `md:`, `lg:` classes
- Mobile-first approach
- Touch-friendly button sizes (min 44x44px)

---

## ⚡ Performance Optimization

### 1. Memoization
```jsx
import { memo } from 'react'

const MemoLeaderboard = memo(Leaderboard)
```

### 2. Lazy Loading
```jsx
import { lazy, Suspense } from 'react'

const QuizTaking = lazy(() => import('./QuizTaking'))

<Suspense fallback={<SkeletonLoader type="quiz" />}>
  <QuizTaking {...props} />
</Suspense>
```

### 3. Data Pagination
```jsx
// Show 10 at a time, load more on scroll
const [page, setPage] = useState(1)
const itemsPerPage = 10
```

---

## 🔄 Error Handling Pattern

```jsx
import { useToast } from './components/Toast'

function MyComponent() {
  const { error, warning } = useToast()

  const handleAction = async () => {
    try {
      const res = await fetch('/api/endpoint')
      if (!res.ok) {
        throw new Error('Failed: ' + res.statusText)
      }
      const data = await res.json()
      success('Success!')
    } catch (err) {
      error(err.message || 'An error occurred')
    }
  }
}
```

---

**All components are production-ready and fully documented! 🚀**
