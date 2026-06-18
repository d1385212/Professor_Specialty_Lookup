<script setup>
defineProps({
  teacher: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['select'])

function selectTeacher(teacher) {
  emit('select', teacher)
}
</script>

<template>
  <article class="teacher-card glass-card" tabindex="0" @click="selectTeacher(teacher)" @keydown.enter="selectTeacher(teacher)">
    <div class="teacher-photo-wrap">
      <img
        v-if="teacher.image"
        class="teacher-photo"
        :src="teacher.image"
        :alt="`${teacher.name} 教授照片`"
      />
      <div v-else class="teacher-photo-placeholder">{{ teacher.name?.slice(0, 1) }}</div>
    </div>

    <div class="teacher-content">
      <div>
        <p class="teacher-title">{{ teacher.title || teacher.category }}</p>
        <h3 class="teacher-name">{{ teacher.name }}</h3>
      </div>

      <p class="teacher-specialty">{{ teacher.specialty }}</p>

      <div class="teacher-score">
        <strong>{{ teacher.stats?.count ? teacher.stats.average.toFixed(1) : '尚無評分' }}</strong>
        <span>{{ teacher.stats?.count || 0 }} 則評價</span>
      </div>

      <div class="tag-list" aria-label="教授專長">
        <span v-for="tag in teacher.tags" :key="tag" class="tag-pill">{{ tag }}</span>
      </div>
    </div>
  </article>
</template>
