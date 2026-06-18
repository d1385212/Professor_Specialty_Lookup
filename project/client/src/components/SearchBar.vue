<script setup>
defineProps({
  categories: {
    type: Array,
    default: () => [],
  },
  activeCategory: {
    type: String,
    default: '全部教授',
  },
})

const searchText = defineModel('searchText', {
  type: String,
  default: '',
})

const emit = defineEmits(['category-change'])

function selectCategory(category) {
  emit('category-change', category)
}
</script>

<template>
  <section class="search-bar glass-card" aria-label="搜尋與分類篩選">
    <div class="filter-section">
      <span class="section-label">教授分類</span>
      <div class="category-filter" role="tablist" aria-label="教授分類">
        <button
          v-for="category in categories"
          :key="category"
          type="button"
          class="filter-chip"
          :class="{ active: category === activeCategory }"
          @click="selectCategory(category)"
        >
          {{ category }}
        </button>
      </div>
    </div>

    <label class="search-field">
      <span class="section-label">關鍵字搜尋</span>
      <input v-model="searchText" type="search" placeholder="輸入教授姓名、專長、職稱或信箱" />
    </label>
  </section>
</template>
