/**
 * Guest List Database
 * 
 * This file contains the raw guest list parsed from the wedding invitation PDF.
 * It dynamically generates the GUEST_DATABASE object at runtime so that names can
 * be easily added, edited, or removed in plain text.
 */

// Raw guest list (format: Lastname Firstname)
const RAW_GUEST_LIST = `
Flores Gregorio
Flores Emma
Flores Axel
Prele Melecio
Prele Elena
Sabando Camille
Prele Carlo
Sabando John
Aguirre Ofelia
Flores Ton
Flores Sanito
Flores Minda
Flores Tzing
Flores Gina
Flores Nelly
Flores Floriman
Flores Nalyn
Flores Zue
De guzman Abigail
De Guzman Mhel
De Guzman Nathan
Flores Val
Flores Sarah
Matnog Jaina
Matnog
Flores Jedda
Flores Aida
Flores Conni
Flores Nicole
Aguirre Eduardo
San Miguel Bhe
Aguirre Ferdinand
Aguirre Precy
Aguirre Jhun
Aguirre Jenel
Aguirre Sally
Aguirre Dj
Aguirre Dudoy
Aguirre Gigi
Aguirre Emily
Lili Hazel
Manalang Jeff
Manalang Zharina
Aguirre Ira
Azana Adrian
Aguirre Alvin
Aguirre Samantha
Lili Given
Canada Charlie
Sangil Regalado
Reyes Cora
Sangil Leah
Calata Rosemarie
Sangil Premie
Aguirre Cynthia
Aguirre Anica
Magada Ligaya
Magada Junior
Magada Enan
agas Eleonor
Dumlao Bella
Alcantara tzing
Bulilan Roland
Bulilan Merva
Perez Jaena
Perez Danny
Edles Neil
Edles Franceska
Bautista Karizza
Magdirila Lysette
Natividad Melay
Gonzales Jahztin
De Guzman Hazel
Limlingan Sandie
Dizon Kristine
Bautista Olivia
Magdirila Mags
Lumibao Jason
Peralta Michael
Urizza Vielson
Lipor Rojilyn
Perlas Kimberlie
Cruz John Eduardo
Macaraeg Joyce
Macalalad Raul
Macalalad
Villamor Alfred
Canlas Maria Cynthia
Canlas Carlos Jr.
Canlas Carlos Juncan
Canlas Carlito
Canlas Kathlyn
Canlas Catherine
Patame Cherry Carla
Patame Kenneth
Patame Cassandra Lewis
Canlas Christopher
Canlas Milca
Canlas Clark
Canlas Ckyrie
Eusebio Imelda
Hossain Sean
Bondoc Rosauro
Bondoc Annie
Bondoc Anthony
Bondoc Anika
Bondoc Patrick
Yasay Raisa
Yasay Justin
Bondoc Ibarra Godofredo
Bondoc Noel
Bondoc Ellen
Bondoc Meryl
Bondoc Mariz
Bondoc Mira
Bondoc Lolit
Bondoc Al
Bondoc Daniel
Bondoc
Bondoc Nen
Canlas Susan
Canlas Fe
Canlas Irma
Canlas
Tan Gov. Angelina Helen
Tan Engr. Ronnel
Sipriaso Engr. Rownel
Sipriaso Angie
Ching Engr. Malvin
Ching Engr. Jacqui
Salem Ronald
Salem Neth
Salem Ramil
Salem Cyrene
Granada Lizel
Granada Greg
Salas Exon
Salas Cris Mari
De Mesa Kerwin
Santiago Rene
Santiago Vangie
Santiago Sonny Boy
Santiago Jean
Castrillo Tony
Castrillo Merla
Castrillo Charlie
Ko Agnes
Diokno Emmie
Timog Bong Bong
TImog Sally
Timog Joji
Timog Terry Lou
Salgado Johnny
Salgado Edna
Patame Edna
Jabagat Yuri
Jabagat Juvie
Ramos Odilon
Carillo Carlo
Zapanta Nico
Lazaro Jel
Casimero Bren
Elizon Robbi
Sapin Raymond
Sapin Rose
Sapin Harvey
Oñate Eugene
San Juan Tristan
Jaraplasan John Paul
Jaraplasan Leann
Jaraplasan Donato
Jaraplasan Arlene
Ilao John Dale
Rodriguez Mario
Belen Renato
Guevarra Reymart
Noguerra Arlon
Pareja Pocholo
Pareja Michelle
Mark Oliver
Peña Mary
De Luna Richard
Estenor Addam
Pasuquin Angeline
Carpio Jaypee
Catapang Nello
Villasfer Radel
Baquiran JM
Santos Chester
Sapin wife
Sapin Sonny Boy
`;

// Helper to capitalize words correctly (respecting titles like Engr. and Gov.)
function formatNamePart(str) {
    if (!str) return '';
    return str.split(' ').map(word => {
        if (!word) return '';
        // If it contains a dot (like Engr. or Gov.), keep it as is but capitalize
        if (word.includes('.')) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        // Handle normal names
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

// Generate the final database mapping slugs to name/group properties
const GUEST_DATABASE = (() => {
    const db = {};
    const lines = RAW_GUEST_LIST.trim().split('\n');
    const seenSlugs = new Set();
    
    // Known compound last names in the PDF list
    const compoundLastNames = [
        "de guzman",
        "san miguel",
        "de mesa",
        "de luna",
        "san juan"
    ];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let lastName = "";
        let firstName = "";
        let displayName = "";

        // Check if the line is exactly "Mark Oliver" (which has a blank last name column)
        if (trimmed.toLowerCase() === "mark oliver") {
            lastName = "";
            firstName = "Mark Oliver";
            displayName = "Mark Oliver";
        } else {
            // Check for compound last names
            let isCompound = false;
            for (const cln of compoundLastNames) {
                if (trimmed.toLowerCase().startsWith(cln + " ")) {
                    lastName = formatNamePart(trimmed.substring(0, cln.length));
                    firstName = trimmed.substring(cln.length + 1).trim();
                    isCompound = true;
                    break;
                }
            }

            if (!isCompound) {
                // Normal case: Lastname Firstname
                const spaceIndex = trimmed.indexOf(' ');
                if (spaceIndex === -1) {
                    // Only last name given (e.g. Matnog, Macalalad, Bondoc)
                    lastName = formatNamePart(trimmed);
                    firstName = "";
                    displayName = `The ${lastName} Family`;
                } else {
                    lastName = formatNamePart(trimmed.substring(0, spaceIndex));
                    firstName = trimmed.substring(spaceIndex + 1).trim();
                }
            }

            // Standardize display name formatting
            if (firstName) {
                if (firstName.toLowerCase() === 'wife') {
                    displayName = `Mrs. ${lastName}`;
                } else {
                    // Check if firstName contains common titles
                    const formattedFirst = formatNamePart(firstName);
                    displayName = `${formattedFirst} ${lastName}`;
                }
            }
        }

        // Generate URL Slug (lowercase, remove titles, replace spaces with hyphens)
        let slugBase = displayName.toLowerCase()
            .replace(/gov\.|engr\.|mr\.|mrs\.|&|\./g, '') // remove titles & punctuation
            .replace(/[^a-z0-9\s-]/g, '')                // remove invalid chars
            .replace(/\s+/g, '-')                         // spaces to hyphens
            .replace(/^-+|-+$/g, '');                     // trim hyphens

        // Resolve slug collisions if any
        let slug = slugBase;
        let counter = 1;
        while (seenSlugs.has(slug)) {
            slug = `${slugBase}-${counter}`;
            counter++;
        }
        seenSlugs.add(slug);

        // Store guest details in database
        db[slug] = {
            name: displayName,
            group: lastName ? `${lastName} Family` : "Guests",
            lastName: lastName,
            firstName: firstName
        };
    });

    return db;
})();
