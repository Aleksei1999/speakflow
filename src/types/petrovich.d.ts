declare module "petrovich" {
  type Gender = "male" | "female" | "androgynous"
  interface Person { gender?: Gender; first?: string; middle?: string; last?: string }
  type CaseName = "nominative" | "genitive" | "dative" | "accusative" | "instrumental" | "prepositional"
  function petrovich(person: Person, caseName: CaseName): Person
  export = petrovich
}
