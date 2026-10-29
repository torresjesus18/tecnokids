// Mantiene las respuestas correctas en el servidor y entrega al navegador solo preguntas públicas.
class QuizGame {
  constructor(questions) {
    this.questions = questions;
    this.byId = new Map(questions.map(q => [q.id, q]));
  }
  publicQuestions() {
    return this.questions.map(({ id, icon, text, options }) => ({ id, icon, text, options }));
  }
  check(id, choice) {
    const q = this.byId.get(id);
    if (!q) return null;
    return { correct: choice === q.answer, answer: q.answer, explanation: q.explanation };
  }
  evaluate(answers) {
    let correct = 0;
    for (const q of this.questions) {
      const a = answers.find(x => x && x.id === q.id);
      if (a && a.choice === q.answer) correct++;
    }
    const total = this.questions.length;
    return { score: Math.round((correct / total) * 100), correct, total, status: correct === total ? 'ok' : 'limited' };
  }
}
module.exports = QuizGame;
