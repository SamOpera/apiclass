// The 36 states of Nigeria plus the Federal Capital Territory, grouped by geopolitical zone.

const ZONES = {
  "north-central": "North Central",
  "north-east": "North East",
  "north-west": "North West",
  "south-east": "South East",
  "south-south": "South South",
  "south-west": "South West",
};

const RAW = [
  ["Benue", "Makurdi", "north-central"],
  ["Kogi", "Lokoja", "north-central"],
  ["Kwara", "Ilorin", "north-central"],
  ["Nasarawa", "Lafia", "north-central"],
  ["Niger", "Minna", "north-central"],
  ["Plateau", "Jos", "north-central"],
  ["Federal Capital Territory", "Abuja", "north-central"],

  ["Adamawa", "Yola", "north-east"],
  ["Bauchi", "Bauchi", "north-east"],
  ["Borno", "Maiduguri", "north-east"],
  ["Gombe", "Gombe", "north-east"],
  ["Taraba", "Jalingo", "north-east"],
  ["Yobe", "Damaturu", "north-east"],

  ["Jigawa", "Dutse", "north-west"],
  ["Kaduna", "Kaduna", "north-west"],
  ["Kano", "Kano", "north-west"],
  ["Katsina", "Katsina", "north-west"],
  ["Kebbi", "Birnin Kebbi", "north-west"],
  ["Sokoto", "Sokoto", "north-west"],
  ["Zamfara", "Gusau", "north-west"],

  ["Abia", "Umuahia", "south-east"],
  ["Anambra", "Awka", "south-east"],
  ["Ebonyi", "Abakaliki", "south-east"],
  ["Enugu", "Enugu", "south-east"],
  ["Imo", "Owerri", "south-east"],

  ["Akwa Ibom", "Uyo", "south-south"],
  ["Bayelsa", "Yenagoa", "south-south"],
  ["Cross River", "Calabar", "south-south"],
  ["Delta", "Asaba", "south-south"],
  ["Edo", "Benin City", "south-south"],
  ["Rivers", "Port Harcourt", "south-south"],

  ["Ekiti", "Ado-Ekiti", "south-west"],
  ["Lagos", "Ikeja", "south-west"],
  ["Ogun", "Abeokuta", "south-west"],
  ["Ondo", "Akure", "south-west"],
  ["Osun", "Osogbo", "south-west"],
  ["Oyo", "Ibadan", "south-west"],
];

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const STATES = RAW.map(function ([name, capital, zone]) {
  return {
    slug: name === "Federal Capital Territory" ? "fct" : slugify(name),
    name: name,
    capital: capital,
    zone: zone,
    zoneName: ZONES[zone],
  };
});

module.exports = { STATES, ZONES };
