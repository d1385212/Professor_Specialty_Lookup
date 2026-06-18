<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import SearchBar from './components/SearchBar.vue'
import TeacherCard from './components/TeacherCard.vue'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'
const ALL_CATEGORY = '全部教授'

const teachers = ref([])
const categories = ref([ALL_CATEGORY])
const activeCategory = ref(ALL_CATEGORY)
const searchText = ref('')
const selectedTeacher = ref(null)
const reviews = ref([])
const loading = ref(true)
const reviewsLoading = ref(false)
const errorMessage = ref('')
const reviewMessage = ref('')

const reviewForm = reactive({
  department: '',
  kindness: 4,
  recommendation: 4,
  workload: 3,
  content: '',
})

const filteredTeachers = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  const mergedTeachers = mergeTeacherRecords(teachers.value)

  return mergedTeachers.filter((teacher) => {
    const matchesCategory =
      activeCategory.value === ALL_CATEGORY || teacher.categories.includes(activeCategory.value)
    const matchesKeyword =
      !keyword ||
      [
        teacher.name,
        teacher.title,
        teacher.category,
        ...teacher.categories,
        teacher.email,
        teacher.specialty,
        ...(teacher.tags || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    return matchesCategory && matchesKeyword
  })
})

const selectedStats = computed(() => {
  if (!selectedTeacher.value) return null
  return buildStats(reviews.value)
})

function normalizeTeacher(teacher) {
  const tags = Array.isArray(teacher.specialties) ? teacher.specialties : []
  const summary = teacher.review_summary || {}
  const count = Number(summary.count) || 0
  const kindness = Number(summary.kindness) || 0
  const recommendation = Number(summary.recommendation) || 0
  const workload = Number(summary.workload) || 0

  return {
    ...teacher,
    specialty: tags.join('、') || '尚未提供專長資料',
    tags: tags.slice(0, 4),
    categories: teacher.category ? [teacher.category] : [],
    titles: teacher.title ? [teacher.title] : [],
    image: teacher.image_url,
    profileUrl: teacher.profile_url,
    stats: {
      count,
      kindness,
      recommendation,
      workload,
      average: count ? (kindness + recommendation + (6 - workload)) / 3 : 0,
    },
  }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))]
}

function teacherIdentityKey(teacher) {
  return [
    teacher.name?.trim(),
    teacher.email?.trim().toLowerCase() || teacher.profileUrl?.trim().toLowerCase() || '',
  ].join('::')
}

function mergeStats(a, b) {
  const aCount = Number(a?.count) || 0
  const bCount = Number(b?.count) || 0
  const count = aCount + bCount

  if (!count) {
    return {
      count: 0,
      kindness: 0,
      recommendation: 0,
      workload: 0,
      average: 0,
    }
  }

  const weighted = (key) => ((Number(a?.[key]) || 0) * aCount + (Number(b?.[key]) || 0) * bCount) / count
  const kindness = weighted('kindness')
  const recommendation = weighted('recommendation')
  const workload = weighted('workload')

  return {
    count,
    kindness,
    recommendation,
    workload,
    average: (kindness + recommendation + (6 - workload)) / 3,
  }
}

function mergeTeacherRecords(records) {
  const grouped = new Map()

  records.forEach((teacher) => {
    const key = teacherIdentityKey(teacher)
    const current = grouped.get(key)

    if (!current) {
      grouped.set(key, {
        ...teacher,
        categories: uniqueValues(teacher.categories || [teacher.category]),
        titles: uniqueValues(teacher.titles || [teacher.title]),
        tags: uniqueValues(teacher.tags || []),
        identityIds: [teacher.id],
      })
      return
    }

    const categories = uniqueValues([...current.categories, teacher.category, ...(teacher.categories || [])])
    const titles = uniqueValues([...current.titles, teacher.title, ...(teacher.titles || [])])
    const tags = uniqueValues([...(current.tags || []), ...(teacher.tags || [])]).slice(0, 6)

    grouped.set(key, {
      ...current,
      title: titles.join(' / '),
      category: categories.join(' / '),
      specialty: tags.join('、') || current.specialty || teacher.specialty,
      categories,
      titles,
      tags,
      image: current.image || teacher.image,
      profileUrl: current.profileUrl || teacher.profileUrl,
      stats: mergeStats(current.stats, teacher.stats),
      identityIds: uniqueValues([...current.identityIds, teacher.id]),
    })
  })

  return [...grouped.values()]
}

function buildStats(items) {
  const count = items.length
  if (!count) {
    return {
      count: 0,
      kindness: 0,
      recommendation: 0,
      workload: 0,
      average: 0,
    }
  }

  const sum = items.reduce(
    (acc, review) => {
      acc.kindness += Number(review.kindness_rating) || 0
      acc.recommendation += Number(review.recommendation_rating) || 0
      acc.workload += Number(review.workload_rating) || 0
      return acc
    },
    { kindness: 0, recommendation: 0, workload: 0 },
  )

  const kindness = sum.kindness / count
  const recommendation = sum.recommendation / count
  const workload = sum.workload / count

  return {
    count,
    kindness,
    recommendation,
    workload,
    average: (kindness + recommendation + (6 - workload)) / 3,
  }
}

function scoreLabel(value) {
  return value ? value.toFixed(1) : '尚無'
}

function stars(value) {
  return '★★★★★'.slice(0, Math.round(value || 0))
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

async function loadTeachers() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [teacherResponse, categoryResponse] = await Promise.all([
      fetch(`${API_BASE}/api/teachers`),
      fetch(`${API_BASE}/api/categories`),
    ])

    if (!teacherResponse.ok || !categoryResponse.ok) {
      throw new Error('API 回應失敗')
    }

    const teacherPayload = await teacherResponse.json()
    const categoryPayload = await categoryResponse.json()

    teachers.value = (teacherPayload.data || []).map(normalizeTeacher)
    categories.value = [ALL_CATEGORY, ...(categoryPayload.data || [])]
  } catch (error) {
    errorMessage.value = '目前無法載入教授資料，請確認後端 server 已啟動。'
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function openTeacher(teacher) {
  selectedTeacher.value = teacher
  reviewMessage.value = ''
  await loadReviews(teacher.id)
}

function closeTeacher() {
  selectedTeacher.value = null
  reviews.value = []
  reviewMessage.value = ''
}

async function loadReviews(teacherId) {
  reviewsLoading.value = true

  try {
    const response = await fetch(`${API_BASE}/api/teachers/${teacherId}/reviews`)
    if (!response.ok) throw new Error('Reviews API 回應失敗')
    const payload = await response.json()
    reviews.value = payload.data || []
  } catch (error) {
    reviewMessage.value = '評價暫時載入失敗。'
    console.error(error)
  } finally {
    reviewsLoading.value = false
  }
}

async function submitReview() {
  if (!selectedTeacher.value || !reviewForm.content.trim()) {
    reviewMessage.value = '請至少填寫一段評價內容。'
    return
  }

  reviewMessage.value = ''

  try {
    const response = await fetch(`${API_BASE}/api/teachers/${selectedTeacher.value.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: reviewForm.department.trim() || '匿名同學',
        kindness_rating: Number(reviewForm.kindness),
        recommendation_rating: Number(reviewForm.recommendation),
        workload_rating: Number(reviewForm.workload),
        content: reviewForm.content.trim(),
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || '送出失敗')
    }

    reviewForm.department = ''
    reviewForm.kindness = 4
    reviewForm.recommendation = 4
    reviewForm.workload = 3
    reviewForm.content = ''
    reviewMessage.value = '評價已送出，謝謝你的分享。'

    await loadReviews(selectedTeacher.value.id)
    selectedTeacher.value.stats = buildStats(reviews.value)
  } catch (error) {
    reviewMessage.value = error.message || '評價送出失敗，請稍後再試。'
  }
}

function handleCategoryChange(category) {
  activeCategory.value = category
}

onMounted(loadTeachers)
</script>

<template>
  <main class="page-shell">
    <header class="site-header">
      <a class="brand-mark" href="/" aria-label="FCU IECS Professor Search 首頁">
        <span class="brand-icon">IE</span>
        <span>FCU IECS Professor Search</span>
      </a>
      <p>以專長、職稱與分類快速找到資工系教授</p>
    </header>

    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Professor Specialty Lookup</p>
        <h1>逢甲資工教授查詢</h1>
        <p class="hero-description">
          從原系所網站整理教授照片、職稱、專長與個人頁連結，並保留同學評價作為教授頁面的補充資訊。
        </p>
      </div>

      <SearchBar
        v-model:searchText="searchText"
        :categories="categories"
        :active-category="activeCategory"
        @category-change="handleCategoryChange"
      />
    </section>

    <section class="results-panel">
      <div class="results-header">
        <div>
          <h2>搜尋結果</h2>
          <p v-if="!loading">{{ filteredTeachers.length }} 位教授</p>
        </div>
      </div>

      <p v-if="loading" class="state-text">載入教授資料中...</p>
      <p v-else-if="errorMessage" class="state-text error">{{ errorMessage }}</p>
      <p v-else-if="filteredTeachers.length === 0" class="state-text">找不到符合條件的教授。</p>

      <div v-else class="teacher-grid">
        <TeacherCard
          v-for="teacher in filteredTeachers"
          :key="teacher.id"
          :teacher="teacher"
          @select="openTeacher"
        />
      </div>
    </section>

    <section
      v-if="selectedTeacher"
      class="review-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="`${selectedTeacher.name} 的教授評價`"
      @click.self="closeTeacher"
    >
      <article class="review-panel">
        <button type="button" class="close-button" aria-label="關閉評價視窗" @click="closeTeacher">
          ×
        </button>

        <header class="review-hero">
          <img
            class="review-photo"
            :src="selectedTeacher.image"
            :alt="`${selectedTeacher.name} 教授照片`"
          />
          <div class="review-heading">
            <p class="teacher-title">{{ selectedTeacher.title || selectedTeacher.category }}</p>
            <h2>{{ selectedTeacher.name }}</h2>
            <p>{{ selectedTeacher.specialty }}</p>
            <a v-if="selectedTeacher.profileUrl" :href="selectedTeacher.profileUrl" target="_blank">
              原網站資料
            </a>
          </div>
        </header>

        <div class="score-row">
          <div class="score-circle">
            <span>{{ scoreLabel(selectedStats?.average) }}</span>
            <small>平均得分</small>
          </div>
          <div class="score-circle">
            <span>{{ scoreLabel(selectedStats?.kindness) }}</span>
            <small>人好程度</small>
          </div>
          <div class="score-circle">
            <span>{{ scoreLabel(selectedStats?.recommendation) }}</span>
            <small>推薦度</small>
          </div>
          <div class="score-circle neutral">
            <span>{{ scoreLabel(selectedStats?.workload) }}</span>
            <small>作業量</small>
          </div>
        </div>

        <form class="review-form" @submit.prevent="submitReview">
          <h3>留下評價</h3>
          <input v-model="reviewForm.department" type="text" placeholder="系級或暱稱（可不填）" />

          <div class="rating-grid">
            <label>
              人好程度
              <input v-model="reviewForm.kindness" type="range" min="1" max="5" />
              <strong>{{ reviewForm.kindness }}</strong>
            </label>
            <label>
              推薦度
              <input v-model="reviewForm.recommendation" type="range" min="1" max="5" />
              <strong>{{ reviewForm.recommendation }}</strong>
            </label>
            <label>
              作業量
              <input v-model="reviewForm.workload" type="range" min="1" max="5" />
              <strong>{{ reviewForm.workload }}</strong>
            </label>
          </div>

          <textarea
            v-model="reviewForm.content"
            rows="4"
            placeholder="分享上課風格、評分方式、點名、報告或考試狀況..."
          />

          <div class="form-actions">
            <p>{{ reviewMessage }}</p>
            <button type="submit">送出評價</button>
          </div>
        </form>

        <section class="review-list">
          <h3>所有評價</h3>
          <p v-if="reviewsLoading" class="state-text">載入評價中...</p>
          <p v-else-if="reviews.length === 0" class="state-text">目前還沒有評價，成為第一位分享的人。</p>

          <article v-for="review in reviews" v-else :key="review.id" class="review-item">
            <div class="review-meta">
              <strong>{{ review.department || '匿名同學' }}</strong>
              <span>{{ formatDate(review.created_at) }}</span>
            </div>
            <div class="review-ratings">
              <span>人好 {{ stars(review.kindness_rating) }}</span>
              <span>推薦 {{ stars(review.recommendation_rating) }}</span>
              <span>作業量 {{ stars(review.workload_rating) }}</span>
            </div>
            <p>{{ review.content }}</p>
          </article>
        </section>
      </article>
    </section>
  </main>
</template>
