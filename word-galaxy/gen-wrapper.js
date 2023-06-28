// https://github.com/spencermountain/compromise
import nlp from 'compromise'

// Another big nlp lib
// https://www.npmjs.com/package/@nlpjs/nlp

import { backOff } from "exponential-backoff";
import { idToArticleStyle } from './defs-articles.js'
import { romanize } from '../js/utils/roman.js'
import { splitSectionToGroups } from './article-utils.js'
//import { transitionsSummary } from '../js/utils/transitions.js'

// Section key needed to check start of line in case title contained roman numeral
//const sectionKey = "Section-Key-"

function checkValidQueryAndStyle(q, idStyle) {
	if (!idToArticleStyle.hasOwnProperty(idStyle)) {
		console.error("Unknown idStyle", idStyle)
		throw new Error(400)
	}
	else if (q.trim() === "") {
		console.error("query is empty")
		throw new Error(400)
	}
}

/* 
q: the query
i: question index (section)
*/
function getPromptMain(q, idStyle, paragraphsPerSection, i) {
	
	checkValidQueryAndStyle(q, idStyle)
	let base;
	let contentDescription;

	if (idStyle === 0) {
		contentDescription = `a ${paragraphsPerSection} paragraph essay`
	}
	else if (idStyle === 1) {
		contentDescription = `a ${paragraphsPerSection} paragraph overview`
	}
	else if (idStyle === 2) {
		if (Math.random() > 0.5) contentDescription = `a ${paragraphsPerSection} paragraph manifesto or proclamation`
		else contentDescription = `a ${paragraphsPerSection} paragraph rant`
	}

	if (i === 0) base = `Here's ${contentDescription} about ${q}`
	else base = `Continuing on, here's ${contentDescription} about how that relates to ${q}`

	if (base.charAt(base.length - 1) !== " ") base += " "

	if (idStyle === 0) {
		return base
	}
	else if (idStyle === 1) {
		return base + `written conversationally in a casual and informal style as if talking to a friend over a cup of coffee who is completely unfamiliar with the topic of ${q}.`
	}
	else if (idStyle === 2) {
		return base + `including my strongest and sometimes unpopular opinions, since I'm not afraid to speak my mind on how I uniquely see ${q}.`
	}
}

/*
Get the prompt for an individual section, for the outline-based generator
sectionHeader: the section topic and subtopics
*/
function getPromptMainOutline(sectionIdx, nSections, queryMain, sectionHeader, idStyle, paragraphsPerSection, useMarkdown) {
	
	checkValidQueryAndStyle(sectionHeader, idStyle)
	
	// The previous
	let base = `The outline references sections of a ${idToArticleStyle[idStyle].toLowerCase()} article about ${queryMain}. ` + 
		`Write section ${sectionIdx+1} / ${nSections} of the article that covers these topics:\n` + 
		`${sectionHeader}\n\n`

	let contentDescription = "";

	if (idStyle === 0) {
		//contentDescription = `in the style of an essay`
		contentDescription = ""
	}
	else if (idStyle === 1) {
		contentDescription = `Write in a casual, informal style.`
	}
	else if (idStyle === 2) {
		contentDescription = "Write in the style of an opinionated rant"
		if (Math.random() > 0.6) contentDescription += " including strong and even sometimes unpopular opinions"
		contentDescription += "."
	}

	if (useMarkdown) {
		if (contentDescription.length > 0) contentDescription += " "
		contentDescription += "Add HTML header tags around titles and subtitles only. No other html tags."
	}
	// Always including subtitle for now
	//if (paragraphsPerSection > 1) contentDescription += " Include a subtitle for each section."
	contentDescription += " Include a creative or thought-provoking subtitle for each section, but do not number the sections in any way."
	// Write on each section in detail.
	// Include a lot of detail in each paragraph as if written by an expert.
	contentDescription += " Include a lot of detail."

	
	// Say at least in case it needs to go over, in the case of 4 headings, and only 3 paragraphs
	let contentLength = `at least ${paragraphsPerSection} paragraph`
	if (paragraphsPerSection > 1) contentLength += "s"
	contentLength += " per subtopic."

	let prompt = base + `Write ${contentLength.trim()} ${contentDescription.trim()}`

	// Special prompt for the conclusion section
	if (sectionHeader.toLowerCase().includes("conclusion") && sectionIdx === nSections - 1) {
		prompt += " For the conclusion section, write 3-5 sentences. If thematically appropriate, include an optimistic spin on the material that leaves the reader feeling good."
	}

	return prompt
}

/* Run after generating the article */
// function getPromptMetaDescription(outlineText) {

// 	if (outlineText.trim() === "") {
// 		console.error("Empty outline to meta prompt")
// 		throw new Error(402)
// 	}

// 	let prompt = "Write a meta description (using less than 155 characters) for an article that covers the topics of: " + outlineText

// 	return prompt
// }

function getPromptMetaDescription() {
	return "Write a meta description for the article using less than 155 characters."
}

function getPromptTitle() {
	return "Write a creative title for the article."
}

function getPromptMetaTitle(title) {
	if (title.trim() === "") {
		console.error("title is empty when adding metatitle")
		throw new Error(400)
	}
	// Rephrase
	return "Write this title as a meta title using less than 54 characters: " + title
}

function getQuestionPrompt(q, idStyle) {

	checkValidQueryAndStyle(q, idStyle)
	
	let prompt;

	if (idStyle === 0) {
		prompt = `People are asking these ten deep and creative questions about ${q}`
	}
	else if (idStyle === 1) {
		prompt = `People are asking these ten deep and creative questions about ${q} (rephrased to be casual and concise)`
	}
	else if (idStyle === 2) {
		prompt = `People are asking these ten creative, insinuating, and opinionated questions about ${q}` // biased
	}

	// Starting with the first question that someone exploring this concept would ask first
	const r = Math.random()
	if (r > 0.66) prompt += " and each new question ties into the previous one, so there is a logical sequence."
	else if (r > 0.33) prompt += " (Each question has a logical progression that leads to the following question)."
	else prompt += " (Each question has a logical implication that leads to asking the following question)."
	
	return prompt
}

function getOutlinePrompt(q, idStyle) {

	checkValidQueryAndStyle(q, idStyle)
	
	let prompt;

	if (idStyle === 0) {
		prompt = `Write a creative outline on ${q}`
	}
	else if (idStyle === 1) {
		prompt = `Write a creative outline on ${q} (with subtopics phrased casually and concisely)`
	}
	else if (idStyle === 2) {
		// "opinionated" triggered the "I am a language model thing"
		prompt = `Write a creative outline on ${q} (with creative, insinuating sections)` // biased
	}

	//prompt += ` and then replace all roman numerals with ${sectionKey}NUMBER, and make sure no line starts with a number.`

	return prompt
}

export class GPTWrapper {
	constructor(apiKey) {
		
		this.apiKey_ = apiKey;

		this.numTokensQuestion_ = 250;
		this.numTokensAnswer_ = 2048;
		// These are just sanity check limits I think to not accidentally spend someone's whole budget
		this.numTokensMetaDescription_ = 600;
		this.numTokensTitle_ = 400;
		this.numTokensMetaTitle_ = 300;

		this.temperatureQuestion_ = 0.4;
		this.temperatureAnswers_ = 0.82;
		this.frequencyPenalty_ = 0.7 // (-2, +2) Default: 0
	
		this.queryActive_ = false;
		this.results_ = [];

		this.mock_ = false;
		this.debug_ = false;
	}

	/* 
	returns { status: 200, text: "article" } or { status: !200, error: "msg for client" }
	updateProgress, (count, maxCount) => 
	*/
	async WriteArticle_(keywordPhrase, idStyle, paragraphsPerSection, updateProgress) {

		// Clear previous
		this._results = [];

		if (!idToArticleStyle.hasOwnProperty(idStyle)) { 
			return { status: 400, error: "Invalid style: " + idStyle }
		}
		else if (paragraphsPerSection <= 0 || paragraphsPerSection > 10) {
			return { status: 400, error: "Invalid paragraphs per section: " + paragraphsPerSection }
		}

		updateProgress(0, 10)

		//return await this.WriteArticleOriginal_(keywordPhrase, idStyle, paragraphsPerSection, updateProgress)
		return await this.WriteArticleUsingOutline_(keywordPhrase, idStyle, paragraphsPerSection, updateProgress)
	}

	/*
	Generate 10 questions, iterate sections sending with context from previous section
	*/
	async WriteArticleOriginal_(keywordPhrase, idStyle, paragraphsPerSection, updateProgress) {

		let questions = await this.GetQuestions_(keywordPhrase.trim(), idStyle, paragraphsPerSection)

		if (questions.status !== 200 || questions.hasOwnProperty('error')) {
			updateProgress(-1, 10)
			return questions
		}

		updateProgress(0.5, 10)

		return await this.SendQuestions_(updateProgress)
	}

	/*
	Generate outline, iterate sections
	*/
	async WriteArticleUsingOutline_(keywordPhrase, idStyle, paragraphsPerSection, updateProgress) {
		
		const useMarkdown = true;

		const includeMetaDescription = true;

		const includeTitle = true;

		const includeMetaTitle = true;

		if (includeMetaTitle && !includeTitle) {
			console.error("Meta title requires title setting to be on")
			throw new Error(400)
		}

		let progressMax = 10

		if (includeMetaDescription) progressMax += 1
		if (includeTitle) progressMax += 1
		if (includeMetaTitle) progressMax += 1

		let outline = await this.GetOutline_(keywordPhrase.trim(), idStyle, paragraphsPerSection, useMarkdown)

		if (outline.status !== 200 || outline.hasOwnProperty('error')) {
			updateProgress(-1, progressMax)
			return outline
		}

		updateProgress(0.5, progressMax)

		return await this.SendOutline_(updateProgress, includeMetaDescription, includeTitle, includeMetaTitle)
	}

	async GetQuestions_(q, idStyle, paragraphsPerSection) { 

		let mock = this.mock_;

		let query = q
		let prompt = getQuestionPrompt(query, idStyle)
		
		let nTokens = this.numTokensQuestion_;
		let temp = this.temperatureQuestion_;
		let resultObj;

		if (query === "" || prompt === "") {
			return { status: 400, error: "Need query" }
		}
		else if (mock) {
			resultObj = await this.MockResponse_(query, prompt, temp, nTokens);
			if (resultObj.status !== 200) return resultObj
		}
		else {
			resultObj = await this.SendQuery_(query, prompt, temp, nTokens);
			if (resultObj.status !== 200) return resultObj
		}

		if (!resultObj) {
			this.queryActive_ = false;
			return { status: 401, error: "Missing result." }
		}
		else {
			if (this.debug_) console.log("R: ", resultObj);
			this.results_.push(resultObj)
			this.TokenizeQuestions_(resultObj)
			this.queryActive_ = false;

			// Update prompts section
			let qs = resultObj.questions

			for (let i=0; i<qs.length; i++) { 
				
				let q = qs[i].text;
				qs[i].original = q
				//q = q.replace(/^\d+\. /, '').trim() // Chop number prefix

				// If query is missing from question, add in original query
				let originalQuery = q
				if (!q.includes(originalQuery)) q = originalQuery + " and " + q 

				// Start prompt with query-prompt from input field
				qs[i].text = getPromptMain(q, idStyle, paragraphsPerSection, i)
			}

			return { status: 200 }
		}
	}

	async GetOutline_(q, idStyle, paragraphsPerSection, useMarkdown) { 

		let mock = this.mock_;
		let query = q
		let prompt = getOutlinePrompt(query, idStyle)
		if (this.debug_) console.log("Outline prompt: ", prompt)
		
		let nTokens = this.numTokensQuestion_;
		let temp = this.temperatureQuestion_;
		let resultObj;

		if (query === "" || prompt === "") {
			return { status: 400, error: "Need query" }
		}
		else if (mock) {
			resultObj = await this.MockResponse_(query, prompt, temp, nTokens);
			if (resultObj.status !== 200) return resultObj
		}
		else {
			let history = [{"role": "system", "content": "You are a wise expert writer who shares an abundance of detail and information on a topic ranging from high level overviews to niche subtopics all the way down to rarely known small details."}]
			resultObj = await this.SendQuery_(query, prompt, temp, nTokens, history);
			if (resultObj.status !== 200) return resultObj
		}

		if (!resultObj) {
			this.queryActive_ = false;
			return { status: 401, error: "Missing result." }
		}
		else {
			if (this.debug_) console.log("R before tokenize: ", resultObj);

			// Add a conclusion section to the end of the outline if it doesn't exist
			let resultLower = resultObj.result.toLowerCase()
			if (!resultLower.includes("conclusion") && !resultLower.includes("summary")) { // "closing"
				resultObj.result = `${resultObj.result.trimEnd()}\nConclusion\n`
			}

			resultObj.queryOriginal = q;
			this.results_.push(resultObj)
			this.TokenizeOutline_(resultObj)
			this.queryActive_ = false;

			// Update prompts section
			let i = 0
			let nSections = resultObj.sections.length
			resultObj.sections.forEach((section) => {
				section.original = section.text;
				section.text = getPromptMainOutline(i, nSections, resultObj.queryOriginal, section.text, idStyle, paragraphsPerSection, useMarkdown)
				i += 1
			})
			
			return { status: 200 }
		}
	}

	//https://github.com/spencermountain/compromise?utm_source=cdnjs&utm_medium=cdnjs_link&utm_campaign=cdnjs_library
	// Returns array of objects, each w/ .text for string sent, .terms array of tokens
	TokenizeSents_(text) {
		try {
			// Tokenizer stopped working suddenly
			//let doc = nlp(text)
			//console.log("Got back doc: ", typeof(doc), doc)
			//let sents = doc.json()
			
			let sentsSplit = text.split(/[\n]+|\d+\. /)
			let sents = []
			for (let i = 0; i < sentsSplit.length; i++) {
				let sent = sentsSplit[i].trim()
				if (sent.length > 0) sents.push({ text: sent })
			}

			return sents;
		}
		catch (error) {
			console.error("Error tokenizing text: ", error, text)
		}
	}

	/*
	query: query,
	queryAndParams: queryAndParams,

	Davinci
	result: data.choices.text
	
	ChatGPT
	choices[0].message.content
	*/
	TokenizeQuestions_(resultObj) {
		// Tokenize into sentences
		let sents = this.TokenizeSents_(resultObj.result);
		resultObj.questions = sents;
	}

	/*
	Parse the outline, producing .sections in the resultObj, each section containing the subtopics also
	each has .text
	Tokenize on newlines, sections indicated by roman numerals
	*/
	TokenizeOutline_(resultObj) {

		let sections = []

		let text = resultObj.result

		try {
			// Tokenizer stopped working suddenly
			//let doc = nlp(text)
			//console.log("Got back doc: ", typeof(doc), doc)
			//let sents = doc.json()
			
			let split = text.split(/[\n]+/)
			let section = [];
			let nSectionsFound = 0
			let nextRomanNumeralStr = "I."
			
			function startsWithRomanNum(sent) {

				let result = {
					matchFull: false,
					matchFullComma: false,
					matchNoPeriod: false
				}

				let numNoPeriod = nextRomanNumeralStr.slice(0, nextRomanNumeralStr.length - 1)

				if (sent.startsWith(nextRomanNumeralStr)) result.matchFull = true
				else if (sent.startsWith(nextRomanNumeralStr.replace(".", ","))) result.matchFullComma = true // GPT generated some with commas probably from Temperature
				else if (sent.startsWith(numNoPeriod + " ")) { 
					if (nSectionsFound > 0) result.matchNoPeriod = true
					else {
						// Special case of "I " for first section vs. "I went to the store.", "I Robot.", "I Am A Dev"
						// Assuming for right now it won't miss the period after the I
						// Otherwise, uncomment below and try to detect

						// If next word is cased let's assume it is roman numeral
						// let rest = sent.slice(2)
						// if (rest.length > 0 && rest.length < 35 && rest.charAt(0).toUpperCase() === rest.charAt(0)) {
						// 	result = true
						// }
						// Maybe include split.indexOf(sent) < 7
					}
				}



				// In case the indexing is off
				// still try to remove the roman numerals
				// even though this is crap
				// if (!result.matchFull && !result.matchNoPeriod) {

				// 	// TODO: new Set()
				// 	let romanNumStrs = [...Array(20).keys()].map((n) => romanize(n))
				// 	console.log("ROMES: ", romanNumStrs)

				// 	let fields = sent.trim().split(" ")
				// 	if (fields.length > 0) {
				// 		let maybeRoman = fields[0].toUpperCase()
				// 		if (maybeRoman.endsWith(".")) maybeRoman = maybeRoman.slice(0, maybeRoman.length-1)
				// 		if (romanNumStrs.includes(maybeRoman)) {
				// 			sentCleaned = 
				// 		}
				// 	}
				// }

				return result 
			}


			split.map((s) => s.trim()).filter((s) => s.length > 0).forEach((sent) => {

				if (this.debug_) console.log("Sent:  ", sent)

				// Detect next roman numeral
				//let nextKey = sectionKey + (nSectionsFound + 1).toString()
				let sentCleaned = sent;
				let startsRoman = startsWithRomanNum(sent)

				if (startsRoman.matchFull || startsRoman.matchFullComma || startsRoman.matchNoPeriod) {
					
					if (section.length > 0) {
						sections.push(section)
						section = []
					}

					// Strip roman numeral with or without period
					if (startsRoman.matchFull) sentCleaned = sentCleaned.slice(nextRomanNumeralStr.length).trim()
					else if (startsRoman.matchFullComma) sentCleaned = sentCleaned.slice(nextRomanNumeralStr.length).trim()
					else if (startsRoman.matchNoPeriod) sentCleaned = sentCleaned.slice(nextRomanNumeralStr.length - 1).trim()

					nSectionsFound += 1
					nextRomanNumeralStr = romanize(nSectionsFound + 1) + "."
				}

				sentCleaned = sentCleaned
					.replace(/^: /, '')
					.replace(/^-+\s?/, '')
					.replace(/^[A-Z0-9]\.\s?/, '')
					.trim()

				if (this.debug_) console.log("Clean: ", sentCleaned)
				if (sentCleaned.length > 0) section.push(sentCleaned)
			})

			if (section.length > 0) sections.push(section)
		}
		catch (error) {
			console.error("Error tokenizing text: ", error, text)
		}

		// Prevent a section with the title "conclusion" or "in conclusion" from appearing before the final section
		//let nSections = sections.length
		
		// Conclusion filtering no longer needed without outline workflow, 
		// having the section index in the prompt seems to resolve any premature conclusion
		/*
		let idx = 0
		sections = sections.filter((s) => {

			// If before the final section, check first or second sent for the word conclusion, 
			// could limit to checking capitalized (including checking the subtitle / header)
			// Problems like "The Conclusion of the Battle of"
			let hasBadConclusion = false
			//let beforeFinal = idx < nSections - 1
			//if (beforeFinal) {

			// Now allowing conclusions
			// Old - Now dropping even the final section if titled conclusion from having a conclusion
			if (false) {
				let firstSentHas = s.length >= 1 ? s[0].toLowerCase().includes("conclusion") : false
				let secondSentHas = s.length >= 2 ? s[1].toLowerCase().includes("conclusion") : false
				hasBadConclusion = firstSentHas || secondSentHas
			}

			if (this.debug_ && hasBadConclusion) console.warn(`Dropping section ${idx} / ${nSections} w/ early conclusion`, s) 
			

			// Try to remove conclusion header if possible to save other good subtopics
			if (hasBadConclusion && 
				s.length > 1 && 
				s.some((sent) => !sent.toLowerCase().includes("conclusion"))
			) {	
				if (this.debug_) console.log("Try save section by splice before: ", s)
				// Splice out any bad sentences
				let badTopics = s.filter((topic) => topic.toLowerCase().includes("conclusion"))
				let badIdxs = badTopics.map((topic) => s.indexOf(topic))  
				for (var i = badIdxs.length -1; i >= 0; i--)
					s.splice(badIdxs[i],1);
				if (s.length > 0) hasBadConclusion = false;
				if (this.debug_ && !hasBadConclusion) console.log("Saved section by splice after: ", s)
			}

			idx += 1
			return !hasBadConclusion
		})
		*/

		// Sanity check limit
		if (sections.length > 22) {
			sections = sections.slice(0, 22)
			console.warn("> 22 sections found: ", sections)
		}

		resultObj.sections = sections.map((s) => (
			// join outline subsections by newline, no roman numeral headings
			{ text: s.join('\n') }
		));

		//console.log("Final Sections: ", resultObj)
		//throw new Error("Break")
	}

	// Post process the generated outline
	PostProcess_(resultObj) {
		
		if (this.debug_) console.log("Before postproc: ", resultObj.answers);

		let sections = []

		resultObj.answers.forEach((a) => {
			
			// https://observablehq.com/@spencermountain/compromise-tokenization

			// Remove any p tags accidentally added by the model, fking temperature
			// Make sure no tokenizing issues resulting from removing the bad p tags
			//let text = "This is just a fu.<p>Here's another sent.</p><p>Ok moving on to other stuff.<p></p><h1>This is a new test.</h1><p>Ok"
			let resultCleaned = a.result.replace(/([^>\s])<p>/g, '$1 ').replace(/<p>/g, '').replace(/<\/p>/g, ' ')

			// Fix bad spacing around HTML tags (just temporary until model is prevented from adding HTML)
			// Cleaning up <h1> Here is the title </h1>
			//resultCleaned = resultCleaned.replace(/(<[A-Za-z].*?>)\s/g, '$1').replace(/\s(<\/.*?>)/g, '$1')
			// This was stripped the newline following html tags causing sent tokenization errors
			//resultCleaned = resultCleaned.replace(/>\s/g, '>').replace(/\s<\//g, '</')

			let doc = nlp(resultCleaned)
			let sents = doc.json().map(o=> o.text)
			if (this.debug_) console.log("Ssplit section: ", sents)

			let section = []
			let titleIdxs = []
			
			sents.forEach((sent) => {

				let sentCleaned = sent
				let sentLower = sent.toLowerCase()

				// Nuclear option just in case
				// if (sentLower.includes("conclusion") && sentLower.length < 21) {
				// 	if (this.debug_) console.log("Caught and nuked: ", sent)
				// 	// sentCleaned = ""
				// 	// sentLower = ""
				// 	return
				// }

				// Could just not include HTML until the end to make it much simpler
				// For now, strip prefix and stuffix html tags
				let htmlPrefix = /^(<.*?>)+/
				let htmlSuffix = /(<\/.*?>)+$/
				let hasPrefix = sentLower.match(htmlPrefix)
				let hasSuffix = sentLower.match(htmlSuffix)
				
				if (hasPrefix && hasPrefix.length > 0) {
					sentLower = sentLower.slice(hasPrefix[0].length)
					sentCleaned = sentCleaned.slice(hasPrefix[0].length)
				}

				if (hasSuffix && hasSuffix.length > 0) {
					sentLower = sentLower.slice(0, -hasSuffix[0].length)
					sentCleaned = sentCleaned.slice(0, -hasSuffix[0].length)
				}
				
				// Strip any language like "In Conclusion", subset of transitionsSummary
				let ts = ["to sum up", "finally", "in conclusion", "lastly", "in summary", "to summarize"]

				ts.forEach((s) => {
					if (sentLower.startsWith(s)) {
						if (sentLower.startsWith(s + ", ")) sentCleaned = sentCleaned.slice(s.length + 2)
						else sentCleaned = sentCleaned.slice(s.length)

						// Capitalize first
						sentCleaned = sentCleaned.charAt(0).toUpperCase() + sentCleaned.slice(1)
						if (this.debug_) console.log("Cleaned transition: ", sent, sentCleaned)
					}
				})

				// Strip any 'Section 1: ' type labeling from the subtitles
				let hasSectionNum = sentLower.match(/^section \d+:\s*/)
				if (hasSectionNum !== null && hasSectionNum.length > 0) {
					sentCleaned = sentCleaned.slice(hasSectionNum[0].length)
					sentLower = sentLower.slice(hasSectionNum[0].length)
					if (this.debug_) console.log("Removing section num from sentence: ", sent, sentCleaned)
				}

				// Prevent any 4th wall breaks
				// I am an AI language
				// as an AI Language model
				let valid = true
				let badStarts = [
					"as an ai,",
					"as an ai large language",
					"as an ai language model",
					"i am an ai language",
					"i'm an ai language",
					"sorry, as",
					"sorry i am",
					"i'm sorry,",
					"i apologize",
					"i cannot "
				]

				if (badStarts.some((s) => sentLower.startsWith(s)) || 
					sentLower.includes(" am an ai language model") || 
					sentLower.includes(" am an ai ")) {
					
					valid = false
					if (this.debug_) console.log("Dropped 4th wall sent: ", sent)
				}

				if (valid) {
					// Reapply HTML prefix / suffix
					if (hasPrefix && hasPrefix.length > 0) sentCleaned = hasPrefix[0] + sentCleaned
					if (hasSuffix && hasSuffix.length > 0) sentCleaned = sentCleaned + hasSuffix[0]
					
					// Add a newline for subtitles
					if (hasPrefix && hasSuffix) {

						//sentCleaned += "\n\n"
						// If a subtitle within the section, not preceded by another title, need newlines before
						let sentIdx = section.length
						titleIdxs.push(sentIdx)

						// if (sentIdx > 0) {
						// 	let prevSent = section[sentIdx-1]
						// 	if (!prevSent.endsWith("\n")) {
						// 		section[sentIdx-1] = prevSent + "\n\n"
						// 	}
						// }
					}

					if (this.debug_ && sentCleaned !== sent) console.log("Clean: ", sentCleaned)
					section.push(sentCleaned)
				}
			})

			// Test
			// let section = [
			//   "<h1>The title of the article</h1>",
			//   "<h3>A subtitle:</h3>",
			//   "The fist sent.",
			//   "The second snt.",
			//   "Third sent.",
			//   "<h3>Another subtitle:</h3>",
			//   "First sent part 2.",
			//   "Second sent part 2.",
			//   "<h3>Another subtitle:</h3>"
			// ]
			// let titleIdxs = [0, 1, 5, 8]

			// Use title idxs to add <p> tags 
			let open = false
			let sectionLen = section.length
			let sectionWithPTags = [] 
			let lastWasTitle = false

			for (let i=0; i < sectionLen; i++) {

				if (titleIdxs.includes(i)) {
				if (open) {
				  sectionWithPTags.push("</p>")
				  open = false      
				}
				sectionWithPTags.push(section[i])
				lastWasTitle = true
				}
			  else {
				if (lastWasTitle || i === 0) {
				  sectionWithPTags.push("<p>")
				  open = true  
				}
				sectionWithPTags.push(section[i])
				lastWasTitle = false
				}
			}

			if (open) sectionWithPTags.push("</p>")
			// console.log(sectionWithPTags)
			// Might be easy to just iterate titleIdxs and 
			// take all sents between titleIdx[i] and titleIdx[i+1]
			section = sectionWithPTags
			
			if (section.length > 0) sections.push(section)
		})
		
		// Split sections into smaller chunks
		let groupSize = 2
		sections = sections.map((s) => splitSectionToGroups(s, groupSize))
		if (this.debug_) console.log("Final sections: ", sections)

		// Each section is a list of sents that also contains <p> open and close tags, 
		// but header tags are within the sentence text themselves right now
		let articleBody = ""
		sections.forEach((s) => {

			// TODO: If sent has .before, .after that saves whitespace from original, can use that to join, better

			s.forEach((sent) => {
				articleBody += sent
				// If not a title, and not an open/close p tag, add space after
				if (!articleBody.endsWith(">") && sent !== "<p>" && sent !== "</p>") articleBody += " "
			})

			articleBody = articleBody.trimEnd()
		})

		// seems redundant
		articleBody = articleBody.trimEnd()

		/*
		Meta Title
		Meta Description
		Title (h1)
		Article body
		*/

		let metadata = ""

		/* Strip leading and trailing quotes */
		function stripQuotes(str) { 
			return str.replace(/^['"]/, '').replace(/['"]$/, '')
		}

		// Prepend the meta title
		if (resultObj.hasOwnProperty('metaTitle')) {
			let metaTitle = resultObj.metaTitle.result.trim()
			// Strip leading/trailing quotes
			metaTitle = stripQuotes(metaTitle)
			metadata += "<p><strong>Meta Title</strong><p>" + metaTitle + "</p>"
		}

		// Prepend the meta description
		if (resultObj.hasOwnProperty('metaDescription')) {
			let metaDescription = resultObj.metaDescription.result.trim()
			// Strip leading/trailing quotes
			metaDescription = stripQuotes(metaDescription)
			metadata += "<p><strong>Meta Description</strong><p>" + metaDescription + "</p>"
		}

		let title = ""
		
		if (resultObj.hasOwnProperty('title')) {
			
			// If model already output an h1 in the body, ignore this title, or include as another option
			// gpt is stupid right, now. will stop it from outputting html soon
			let titleExists = articleBody.slice(0, 200).includes("<h1>") || articleBody.slice(0, 200).includes("< h1 >")

			if (!titleExists) {

				title = resultObj.title.result.trim()

				// Strip leading/trailing quotes
				title = stripQuotes(title)
				title = "<h1>" + title + "</h1>"
			}
		}

		let article = metadata + title + articleBody

		if (this.debug_) console.log("Final formatted", article)

		return article
	}

	async SendQuestions_(updateProgress) {

		let temperature = this.temperatureAnswers_;
		let maxTokens = this.numTokensAnswer_;

		// Get last result
		let resultObj = this.results_[this.results_.length - 1];

		if (!resultObj || !resultObj.hasOwnProperty("questions")) {
			return { status: 405, error: "No questions found" };
		}

		let qs = resultObj.questions;

		for (let i=0; i<qs.length; i++) {
			
			let q = qs[i].text;
			//q = q.replace(/^\d+\. /, '').trim() // Chop number prefix
			
			// Turn on/off include context
			let includeContext = true

			// Can try to include context of previous answer
			if (i > 0 && resultObj.answers.length > 0 && includeContext) {
				//q = 
				let lastAnswer = resultObj.answers[resultObj.answers.length-1].result
				lastAnswer = lastAnswer.split(" ").slice(-70).join(" ")
				if (lastAnswer.length > 0) {
					q = lastAnswer + " " + q
				}
			}

			try {
				if (this.debug_) console.log(`Sending q: ${i} / ${qs.length}`)
				/*
				answer
				{
					status: 200,
					query: query,
					queryAndParams: queryAndParams,
					response: data,
					result: data.choices[0].text
				}
				*/
				let answer;
				if (this.mock_) answer = { status: 200, result: "mock answer: " + i.toString() };
				else answer = await this.SendQuery_(q, q, temperature, maxTokens)
				
				this.queryActive_ = false;
				if (answer.status !== 200) return { status: answer.status, error: answer.error ? answer.error : "Unknown error" }
				resultObj.answers.push(answer)
			}
			catch (error) {
				this.queryActive_ = false;
				return { status: 500, error: "Error with question: " + q + "\n" + error };
			}

			updateProgress(i + 1, qs.length)
		}

		let as = resultObj.answers;
		let qAndA = ""
		//console.log("AS: ", as);

		for (let i=0; i<as.length; i++) {
			let q = qs[i].original;
			let a = as[i].result;
			//console.log("loop: ", qAndA)
			qAndA = qAndA + q.trim() + " " + a + "\n\n"
		}

		this.queryActive_ = false;
		return { status: 200, text: qAndA }
	}

	/*
	Meta description:
		<meta name="description" content="Self-sharpening mechanical pencil that...">
	*/
	async SendOutline_(updateProgress, includeMetaDescription, includeTitle, includeMetaTitle) {


		// TODO: The queryActive var below is messed up, needs to be reconfig'd to handle the new meta descrip and title

		if (includeMetaTitle && !includeTitle) {
			let error = "Meta title requires title to be on"
			console.error(error)
			return { 
				status: 400, 
				error: error, 
				debug: "Metatitle requires title"
			};
		}

		let temperature = this.temperatureAnswers_;
		let maxTokens = this.numTokensAnswer_;

		// Get last result
		let resultObj = this.results_[this.results_.length - 1];

		if (!resultObj || !resultObj.hasOwnProperty("sections")) {
			return { status: 405, error: "No sections found" };
		}

		let qs = resultObj.sections;

		/*
		Include the previously generated outline as context
		Use param for previousMsgsOpt
		ex.
		{"role": "system", "content": "You are a helpful assistant."},
		{"role": "user", "content": "Who won the world series in 2020?"},
		{"role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020."}
		*/
		// Remove any A,B,C headings from the outline so it doesn't copy those into the output subtitles
		let outline = resultObj.result
			.split('\n')
			.map((sent) => sent.replace(/^[A-Z0-9]\.\s?/, ''))
			.join("\n").slice(0, 1800) // Limit the length

		let history = [
			{"role": "system", "content": "You are a wise, eloquent expert writer with an impressive vocabulary."},
			{"role": "user", "content": "Before starting the article, first create an outline on a topic you enjoy and can write a highly detailed article about."},
			{"role": "assistant", "content": `The topic will be ${resultObj.queryOriginal}:\n\n` + outline }
		]

		// No outline sent
		let historyForMetaTitle = [
			history[0],
			{"role": "user", "content": "Pick a topic you enjoy and can write a highly detailed article about."},
			{"role": "assistant", "content": `The topic will be ${resultObj.queryOriginal}`}
		]

		let progressMax = qs.length
		if (includeMetaDescription) progressMax += 1
		if (includeTitle) progressMax += 1
		if (includeMetaTitle) progressMax += 1

		for (let i=0; i<qs.length; i++) {
			
			let q = qs[i].text;
			//q = q.replace(/^\d+\. /, '').trim() // Chop number prefix
			
			try {
				if (this.debug_) console.log(`Sending q: ${i} / ${qs.length}`)
				/*
				answer
				{
					status: 200,
					query: query,
					queryAndParams: queryAndParams,
					response: data,
					result: data.choices[0].text
				}
				*/
				
				let answer;
				if (this.mock_) answer = { status: 200, result: "mock answer: " + i.toString() };
				else answer = await this.SendQuery_(q, q, temperature, maxTokens, history)
				
				this.queryActive_ = false;
				if (answer.status !== 200) return { status: answer.status, error: answer.error ? answer.error : "Unknown error" }
				resultObj.answers.push(answer)
			}
			catch (error) {
				this.queryActive_ = false;

				return { 
					status: 500, 
					error: JSON.stringify(error), // Just added
					//errorShowUser:
					debug: "Error with section: " + q + "\n" 
				};
			}

			updateProgress(i + 1, progressMax)
		}

		let progress = qs.length

		// Meta Description
		
		if (includeMetaDescription) {

			let promptMetaDescrip = getPromptMetaDescription()
			
			try {
				if (this.debug_) console.log(`Sending meta descrip prompt: ${promptMetaDescrip}`)

				let answer;
				if (this.mock_) answer = { status: 200, result: "mock meta descip: An article on things."};
				else answer = await this.SendQuery_(
					promptMetaDescrip, promptMetaDescrip, temperature, this.numTokensMetaDescription_, history)
				
				this.queryActive_ = false;
				if (answer.status !== 200) return { status: answer.status, error: answer.error ? answer.error : "Unknown error" }
				resultObj.metaDescription = answer
			}
			catch (error) {
				this.queryActive_ = false;
				return { 
					status: 500, 
					error: error, 
					debug: "Error with meta description."
				};
			}

			progress += 1
			updateProgress(progress, progressMax)
		}

		// Title 

		if (includeTitle) {

			let promptTitle = getPromptTitle()
			
			try {
				if (this.debug_) console.log(`Sending title prompt: ${promptTitle}`)

				let answer;
				if (this.mock_) answer = { status: 200, result: "mock title: A Good Title For An Article."};
				else answer = await this.SendQuery_(
					promptTitle, promptTitle, temperature, this.numTokensTitle_, history)
				
				this.queryActive_ = false;
				if (answer.status !== 200) return { status: answer.status, error: answer.error ? answer.error : "Unknown error" }
				resultObj.title = answer
			}
			catch (error) {
				this.queryActive_ = false;
				return { 
					status: 500, 
					error: error, 
					debug: "Error with title."
				};
			}

			progress += 1
			updateProgress(progress, progressMax)
		}

		// Meta Title

		if (includeMetaTitle) {

			// If title is short enough to be a meta title that is shown fully without truncating, use title as metatitle
			if (resultObj.title.result.length < 55) {
				resultObj.metaTitle = {
					result: resultObj.title.result
				}
			}
			else {
				let promptMetaTitle = getPromptMetaTitle(resultObj.title.result)
				
				try {
					if (this.debug_) console.log(`Sending title prompt: ${promptMetaTitle}`)

					let answer;
					if (this.mock_) answer = { status: 200, result: "mock meta title: A Good Title (short)"};
					else answer = await this.SendQuery_(
						promptMetaTitle, promptMetaTitle, temperature, this.numTokensMetaTitle_, historyForMetaTitle)
					
					this.queryActive_ = false;
					if (answer.status !== 200) return { status: answer.status, error: answer.error ? answer.error : "Unknown error" }
					resultObj.metaTitle = answer
				}
				catch (error) {
					this.queryActive_ = false;
					return { 
						status: 500, 
						error: error.hasOwnProperty("message") ? error.message : JSON.stringify(error), 
						debug: "Error with meta title."
					};
				}
			}

			progress += 1
			updateProgress(progress, progressMax)
		}

		let output = this.PostProcess_(resultObj)
		this.queryActive_ = false;
		return { status: 200, text: output }
	}


	async MockResponse_(event, query, prompt, temperature, maxTokens) {

		// Davinci
		let data = {
			"id": "cmpl-",
			"object": "text_completion",
			"created": 2048724333,
			"model": "text-davinci-003",
			"choices": [
				{
					"text": "\n\n1. What kind of dog do you have?\n2. How young is your dog?\n3. How often do you take your dog for a walk?\n4. Does your dog have any health issues?\n5. What type of food do you feed your dog?\n6. Does your dog have any behavioral issues?\n7. How often do you groom your dog?\n8. Does your dog have any allergies?\n9. Does your dog get along with other animals?\n10. Does your dog have any special needs?",
					"index": 0,
					"logprobs": null,
					"finish_reason": "stop"
				}
			],
			"usage": {
				"prompt_tokens": 10,
				"completion_tokens": 113,
				"total_tokens": 123
			}
		}

		// ChatGPT
		// {
		//  'id': 'chatcmpl-6p9XYPYSTTRi0xEviKjjilqrWU2Ve',
		//  'object': 'chat.completion',
		//  'created': 1677649420,
		//  'model': 'gpt-3.5-turbo',
		//  'usage': {'prompt_tokens': 56, 'completion_tokens': 31, 'total_tokens': 87},
		//  'choices': [
		//    {
		// 	'message': {
		// 	  'role': 'assistant',
		// 	  'content': 'The 2020 World Series was played in Arlington, Texas at the Globe Life Field, which was the new home stadium for the Texas Rangers.'},
		// 	'finish_reason': 'stop',
		// 	'index': 0
		//    }
		//   ]
		// }

		// Outline
		// "Outline:\nI. Introduction\nA. Brief overview of Dark Souls II\nB. Importance of the game in the Souls series\nII. Storyline\nA. Setting and premise\nB. Protagonist's mission and goals\nC. Major characters and their roles\nIII. Gameplay Mechanics\nA. Combat system and controls\nB. Character customization\nC. Level design and exploration\nD. Multiplayer features\nIV. Difficulty and Challenge\nA. Reputation for difficulty\nB. Unique challenges faced by players\nC. Learning curve\nV. Reception and Criticism\nA. Critical acclaim\n1) Positive reviews from critics\n2) Awards received by the game\nB.Criticisms of the game\n1) Issues with graphics and performance\n2) Complaints about story pacing\nVI.Conclusion\nA.Summary of key points\nB.Impact on gaming industry"

		let r = {
			status: 200,
			query: query,
			queryAndParams: "mock",
			response: data,
			result: data.choices[0].text,
			answers: []
		}

		return r;
	}

	// Given keyword, submit query for questions
	// For each question, expand 
	async SendQuery_(query, prompt, temperature, maxTokens, previousMsgsOpt) {
		
		if (this.queryActive_) {
			return { status: 400, error: "Wait for existing query to finish." };
		}
		
		if (query === "") {
			return { status: 400, error: "Can't submit empty query." };
		}
		else {
			if (this.debug_) console.log(`Sending query [${query}]`)
			this.queryActive_ = true;

			// TODO: Validate input query

			// Davinci
			// See params:
			// https://beta.openai.com/docs/api-reference/completions/create?lang=node.js
			// const queryAndParams = {
			// 	"model": "text-davinci-003",
			// 	"prompt": prompt,
			// 	"temperature": temperature, // Higher values means more risky choices 
			// 	"max_tokens": maxTokens // Upper bound on returned token number
			// 	// n, num responses to generate 
			// 	// top_p, nucleus sampling
			// 	// presence penalty, frequency penalty
			// };

			let messages = [{"role": "user", "content": prompt }]

			/*
			Put any context history before front of the prompt
			
			ex.
			{"role": "system", "content": "You are a helpful assistant."},
			{"role": "user", "content": "Who won the world series in 2020?"},
			{"role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020."}
			*/
			if (previousMsgsOpt) {
				messages = [
					...previousMsgsOpt,
					messages[0]
				]
			}

			// GPT3.5Turbo
			const queryAndParams = {
				"model": "gpt-3.5-turbo", // -0301
				//"prompt": prompt,
				"messages": messages,
				"frequency_penalty": this.frequencyPenalty_, // (-2, +2) Default: 0 
				"temperature": temperature, // Higher values means more risky choices 
				"max_tokens": maxTokens // Upper bound on returned token number
				// n, num responses to generate 
				// top_p, nucleus sampling
			};

			// Davinci
			// const requestUrl = 'https://api.openai.com/v1/completions'
			// ChatGPT
			const requestUrl = 'https://api.openai.com/v1/chat/completions'

			/*
			Do exponential backoff for requests since:
			Free accounts hit the rate limit very easily
			Paid accounts sometimes get a model overloaded error
			*/
			const shouldRetryChatAPI = (err, attemptNumber) => {

				if (this.debug_) console.warn(`Retry, attempt ${attemptNumber}`, err)
				
				// Only retry if error is hitting the rate limit, or model overloaded
				if (err.message && (err.message === "429" || err.message === "499")) {

					// Show to user eventually
					// console.warn(`Article process taking longer than avg due to: \n
					// 	Rate limit reached for default-gpt-3.5-turbo in organization org-ID on requests per min. 
					// 	Limit: 3 / min. Please try again in 20s. Contact support@openai.com if you continue to have issues.
					// 	Please add a payment method to your account to increase your rate limit. 
					// 	Visit https://platform.openai.com/account/billing to add a payment method.`
					// )
					return true
				}

				return false
			}

			/*
			Returns the result response.json(),
			an error with { status: number, error: privateMessage, errorShowUser: msgToDisplay }
			Or throws an error if attempts exceeded, or other response parsing issue
			*/
			const sendRequest = () => fetch(requestUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					//'Accept': 'application/json',
					'Authorization': `Bearer ${this.apiKey_}`//,
					//'mode': 'no-cors'
				},
				body: JSON.stringify(queryAndParams)
			}).then(async function(resp) {
				
				const data = await resp.json()

				if (resp.ok) {

					return {
						status: resp.status,
						data: data
					}
				}
				else {

					// Handle rate limit and quota messages separately despite sharing 429 code
					let maybeMessage = ""

					if (data.hasOwnProperty('error') && 
						data.error.hasOwnProperty('message')) {
						maybeMessage = data.error.message
					}
					
					// You exceeded your current quota, please check your plan and billing details.
					let exceededQuota = maybeMessage.includes("exceeded your current quota")
					// They send 'experienced an error' and 'The server had an error while processing your request. Sorry about that!'
					let recoverableErrorOther = maybeMessage.includes("an error while processing your request")

					/*
					TODO: pass the ID back to display to the client
					Id's are only returned occasionally 

					The server had an error while processing your request. Sorry about that! 
					You can retry your request, or contact us through our help center at help.openai.com if the error persists. 
					(Please include the request ID 5b0cf1e6672a974221841460d0e49686 in your message.)
					*/


					/*
					Rate limit reached for default-gpt-3.5-turbo in organization org-ID on requests per min. 
					Limit: 3 / min. Please try again in 20s. Contact support@openai.com if you continue to have issues.
					Please add a payment method to your account to increase your rate limit. 
					Visit https://platform.openai.com/account/billing to add a payment method.
					*/
					if (resp.status === 429 && !exceededQuota) {
						// 429 also includes model overloaded error, and exceeded quota error, but do not retry on quota
						throw new Error(429)
					}
					else if (recoverableErrorOther) {
						throw new Error(499)
					}
					else {
						console.warn(resp)
						// const data = await resp.json()
						const message = `Error sending query: ${resp.status}\nQuery: [${query}]\nResp: ${JSON.stringify(data)}`;
						console.warn("Tried sending queryAndParams: ", queryAndParams, data)
						console.warn(data.hasOwnProperty('error'), data.hasOwnProperty('error') ? data.error.hasOwnProperty('message') : false)
						let errorResult = { status: 500, error: message }
						//console.log("API error: ", data.hasOwnProperty("error"))
						//console.log("API error.message: ", data.hasOwnProperty("error"))

						// If direct message from API
						if (data.hasOwnProperty('error') && 
							data.error.hasOwnProperty('message')) {
							errorResult.errorShowUser = data.error.message
						}

						return errorResult
					}
				}
			})

			let resp;

			try {
				resp = await backOff(() => sendRequest(), { 
					// numOfAttempts: 10,
					startingDelay: 22000, // 22 seconds
					timeMultiple: 2, // Delay between attempts is startingDelay * timeMultiple
					retry: shouldRetryChatAPI
				});
			}
			catch (err) {

				// Backoff may result in an error thrown when all attempts exceeded for backoff, or parsing with .json
				console.warn("Backoff failed with error: ", err)
				console.trace()

				// If max attempts exceeded, we throw a 429, so show a modified OpenAI message instead of "429"
				// Otherwise the response will complete with a normal error 
				let errorShowUser = err.message

				if (errorShowUser === "429") {
					errorShowUser = `Failed due to rate limit (after exceeding max attempts). If your account with openAI is a free account, 
						please add a payment method to increase your rate limit. 
						Visit https://platform.openai.com/account/billing to add a payment method.
						Contact support@openai.com if you continue to have issues.`
				}
				else if (errorShowUser === "499") {
					errorShowUser = `The server experienced an error while processing your request. Sorry about that! 
					You can retry your request, or contact us through our help center at help.openai.com if the error persists. (Exceeded max attempts)`
				}

				let stackTrace = new Error().stack

				resp = {
					status: 501,
					error: err.name + ": " + err.message + "\nTrace: " + stackTrace,
					errorShowUser: errorShowUser 
				}
			}

			if (this.debug_) console.log("API result: ", resp);

			if (resp.status !== 200) {
				return resp;
			}

			let data = resp.data
			
			if (!data.hasOwnProperty("choices")) {
				return { status: 500, error: "No choices prop found in resp: " + JSON.stringify(data)};
			}
			else {
				// Save and display result

				// Davinci
				// let resultObj = {
				// 	query: query,
				// 	queryAndParams: queryAndParams,
				// 	response: data,
				// 	result: data.choices[0].text,
				// 	answers: []
				// }

				// ChatGPT
				let resultObj = {
					status: 200,
					query: query,
					queryAndParams: queryAndParams,
					response: data,
					result: data.choices[0].message.content,
					answers: []
				}
				
				return resultObj;
			}
		}
	}
}
